import type { GameState, CardName } from "../types/game-state";
import { CARDS, isTreasureCard } from "../data/cards";
import { getCardCost } from "../cards/cost";
import { countCards } from "../lib/card-array-utils";
import { countVP, getAllCards } from "../lib/board-utils";
import { getSubPhase } from "../lib/state-helpers";
import { run } from "../lib/run";
import { checkGameOver } from "../commands/handle-helpers";
import { getLegalActions } from "./legal-actions";
import { projectPendingChoiceForAI } from "./pending-choice-projection";

const DEFAULT_PROVINCE_COUNT = 8;
const PILES_NEAR_END = 2;
const NEXT_HAND_SIZE = 5;
const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;

export function getDecisionPlayerId(state: GameState): string {
  return state.pendingChoice?.playerId ?? state.activePlayerId;
}

// Transform game state to use counts instead of arrays for AI consumption
// Nests all "your" state together for clearer AI reasoning
export function optimizeStateForAI(state: GameState) {
  const decisionPlayerId = getDecisionPlayerId(state);
  const decisionPlayer = state.players[decisionPlayerId];
  // Transform supply to array with counts and effective costs
  const supplyWithCounts = Object.entries(state.supply).map(([card, count]) => {
    return {
      card,
      count,
      cost: getCardCost(state, card as CardName).modifiedCost,
    };
  });

  // Calculate treasures still in hand
  const treasuresInHand = decisionPlayer
    ? decisionPlayer.hand.filter(isTreasureCard)
    : [];

  // Calculate current game stage
  const provincesLeft = state.supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const currentGameStage = run(() => {
    if (
      provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD ||
      Object.values(state.supply).filter(count => count <= 0).length >=
        PILES_NEAR_END
    )
      return "Late";
    if (state.turn <= EARLY_GAME_TURN_THRESHOLD) return "Early";
    return "Mid";
  });

  // Calculate VP and deck composition for both players
  const yourAllCards = decisionPlayer ? getAllCards(decisionPlayer) : [];

  const yourVP = countVP(yourAllCards);

  const yourDeckCounts = countCards(yourAllCards);

  // Build "you" object with all your state nested together
  const you: Record<string, unknown> = {
    playerId: decisionPlayerId,
    isYourTurn: decisionPlayerId === state.activePlayerId,
    currentPhase: state.phase,
    currentActions:
      decisionPlayerId === state.activePlayerId ? state.actions : null,
    currentBuys: decisionPlayerId === state.activePlayerId ? state.buys : null,
    currentCoins:
      decisionPlayerId === state.activePlayerId ? state.coins : null,
    currentVictoryPoints: yourVP,
    currentDeckComposition: yourDeckCounts,
    currentHand: decisionPlayer ? countCards(decisionPlayer.hand) : {},
    currentDiscard: decisionPlayer ? countCards(decisionPlayer.discard) : {},
    currentInPlay: decisionPlayer ? countCards(decisionPlayer.inPlay) : {},
    // Add revealed deck cards when applicable
    ...(decisionPlayer?.deckTopRevealed && decisionPlayer.deck.length > 0
      ? { deckTopCards: decisionPlayer.deck.slice(-1) }
      : {}),
    // Buy phase helper: treasures you can still play (always show in buy phase)
    ...(state.phase === "buy" && decisionPlayerId === state.activePlayerId
      ? { currentTreasuresInHand: countCards(treasuresInHand) }
      : {}),
  };

  const opponents = buildPublicPlayerSummaries(state).filter(
    p => p.playerId !== decisionPlayerId,
  );
  const bestOpponentVP = Math.max(
    ...opponents.map(p => p.currentVictoryPoints),
  );

  const subPhase = getSubPhase(state);

  return {
    turn: state.turn,
    activePlayerId: state.activePlayerId,
    decisionPlayerId,
    currentGameStage,
    you,
    opponents,
    decisionFacts: {
      ...deckFacts(yourAllCards),
      drawPileCount: decisionPlayer?.deck.length ?? 0,
      discardPileCount: decisionPlayer?.discard.length ?? 0,
      nextFiveCardDrawNeedsShuffle:
        (decisionPlayer?.deck.length ?? 0) < NEXT_HAND_SIZE,
      scoreLead: opponents.length ? yourVP - bestOpponentVP : 0,
      emptyPiles: Object.entries(state.supply)
        .filter(([, count]) => count <= 0)
        .map(([card]) => card),
      purchaseConsequences: purchaseConsequences(state),
    },
    supply: supplyWithCounts,
    trash: state.trash,
    ...(state.pendingChoice
      ? { pendingChoice: projectPendingChoiceForAI(state.pendingChoice) }
      : {}),
    ...(subPhase ? { subPhase } : {}),
  };
}

/** Counts public ownership, without revealing opponents' hidden zones or order. */
export function buildPublicPlayerSummaries(state: GameState) {
  return Object.entries(state.players).map(([playerId, player]) => {
    const cards = getAllCards(player);
    return {
      playerId,
      currentVictoryPoints: countVP(cards),
      totalCards: cards.length,
      currentDeckComposition: countCards(cards),
      currentDiscard: countCards(player.discard),
      currentInPlay: countCards(player.inPlay),
    };
  });
}

function deckFacts(cards: CardName[]) {
  const actions = cards.filter(card => CARDS[card].types.includes("action"));
  const printedBonus = (card: CardName, kind: string) =>
    Number(
      CARDS[card].description.match(
        new RegExp(`\\+(\\d+) ${kind}`, "i"),
      )?.[1] ?? 0,
    );
  return {
    totalCards: cards.length,
    actionCards: actions.length,
    terminalActions: actions.filter(card => printedBonus(card, "Action") === 0)
      .length,
    printedExtraActions: actions.reduce(
      (sum, card) => sum + Math.max(0, printedBonus(card, "Action") - 1),
      0,
    ),
    printedDrawCards: actions.reduce(
      (sum, card) => sum + printedBonus(card, "Card"),
      0,
    ),
    note: "Printed bonuses only; conditional effects, replay and action order can change actual output.",
  };
}

/** One-buy projection using the engine's scoring and ending rules; no hidden draws. */
function purchaseConsequences(state: GameState) {
  if (state.pendingChoice || state.phase !== "buy") return [];
  const player = state.players[state.activePlayerId];
  if (!player) return [];
  return getLegalActions(state).flatMap(action => {
    if (action.type !== "buy_card" || !action.card) return [];
    const card = action.card;
    const after = {
      ...state,
      supply: { ...state.supply, [card]: (state.supply[card] ?? 0) - 1 },
      players: {
        ...state.players,
        [state.activePlayerId]: {
          ...player,
          discard: [...player.discard, card],
        },
      },
    };
    const ending = checkGameOver(after);
    return [
      {
        card,
        vpAfterPurchase: countVP([...getAllCards(player), card]),
        triggersGameEnd: ending !== null,
        ...(ending?.type === "GAME_ENDED"
          ? {
              scoresIfNoFurtherChanges: ending.scores,
              winnerIdIfNoFurtherChanges: ending.winnerId,
            }
          : {}),
      },
    ];
  });
}
