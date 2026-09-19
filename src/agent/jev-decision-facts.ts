import type { Action } from "../types/action";
import type { GameState, CardName } from "../types/game-state";
import { hasCardField } from "../lib/action-utils";
import { CARDS } from "../data/cards";
import { countVP, getAllCards } from "../lib/board-utils";
import {
  getDecisionPlayerId,
  printedBonus,
  purchaseConsequences,
} from "./state-projection";

// Jev reads numbers as text and cannot do arithmetic, so code turns the
// counts it would otherwise have to compare into named facts.

const PROVINCE_VP = 6;
const RICH_COINS_PER_CARD = 1.1;
const THIN_COINS_PER_CARD = 0.8;
const PILES_NEAR_END = 2;

function scorePosition(state: GameState) {
  const you = getDecisionPlayerId(state);
  const yourVP = countVP(getAllCards(state.players[you] ?? emptyPlayer()));
  const bestOpponent = Math.max(
    ...Object.entries(state.players)
      .filter(([id]) => id !== you)
      .map(([, player]) => countVP(getAllCards(player))),
  );
  const lead = yourVP - bestOpponent;
  if (lead === 0) return "tied on victory points";
  const size =
    Math.abs(lead) >= PROVINCE_VP
      ? "a Province or more"
      : `${Math.abs(lead)} VP`;
  return lead > 0 ? `ahead by ${size}` : `behind by ${size}`;
}

const emptyPlayer = () => ({
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  inPlaySourceIndices: [],
});

function gameEndProximity(state: GameState) {
  const provincesLeft = state.supply["Province"] ?? 0;
  const emptyPiles = Object.values(state.supply).filter(n => n <= 0).length;
  if (provincesLeft <= 1 || emptyPiles >= PILES_NEAR_END) {
    return "the game can end on the next purchase";
  }
  if (provincesLeft <= 3) return "the game is close to ending";
  return "the game is not close to ending";
}

function deckMoney(state: GameState) {
  const cards = getAllCards(
    state.players[getDecisionPlayerId(state)] ?? emptyPlayer(),
  );
  const coins = cards.reduce((sum, card) => sum + (CARDS[card].coins ?? 0), 0);
  const density = cards.length ? coins / cards.length : 0;
  if (density >= RICH_COINS_PER_CARD) return "rich in money";
  if (density <= THIN_COINS_PER_CARD) return "thin on money";
  return "average money";
}

/** Named facts about the decision, computed once per state */
export function decisionSummary(state: GameState) {
  return {
    scorePosition: scorePosition(state),
    gameEnd: gameEndProximity(state),
    deckMoney: deckMoney(state),
  };
}

function endingNote(state: GameState, card: CardName): string | null {
  const projection = purchaseConsequences(state).find(p => p.card === card);
  if (!projection?.triggersGameEnd) return null;
  const you = getDecisionPlayerId(state);
  const winner = projection.winnerIdIfNoFurtherChanges;
  const outcome =
    winner === you
      ? "YOU WIN"
      : winner === null
        ? "the game is a TIE"
        : "YOU LOSE";
  return `Buying this ENDS THE GAME immediately and ${outcome} on final score.`;
}

function actionNote(state: GameState, card: CardName): string | null {
  const extraActions = printedBonus(card, "Action");
  if (extraActions > 0) {
    return `Gives +${extraActions} Action${extraActions > 1 ? "s" : ""}: playing it first keeps your other action cards playable.`;
  }
  return state.actions <= 1
    ? "Terminal: this spends your last action, so no other action card can be played this turn."
    : "Terminal: gives no +Action.";
}

function emptyPileNote(state: GameState, card: CardName): string | null {
  const givesCurses = /curse/i.test(CARDS[card].description);
  if (!givesCurses || (state.supply["Curse"] ?? 0) > 0) return null;
  return "The Curse pile is empty, so this card's Curse-giving effect does nothing.";
}

const joinNotes = (notes: (string | null)[]): string | null => {
  const present = notes.filter((note): note is string => note !== null);
  return present.length ? present.join(" ") : null;
};

/** Per-option facts that depend on the current state, not just the card */
export function optionFacts(state: GameState, action: Action): string | null {
  if (!hasCardField(action)) return null;
  if (action.type === "buy_card") {
    return joinNotes([
      endingNote(state, action.card),
      emptyPileNote(state, action.card),
    ]);
  }
  if (action.type === "play_action") {
    return joinNotes([
      actionNote(state, action.card),
      emptyPileNote(state, action.card),
    ]);
  }
  return null;
}
