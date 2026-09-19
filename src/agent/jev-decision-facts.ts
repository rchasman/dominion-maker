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
// counts it would otherwise have to compare into named facts. Every fact
// here is provable from the engine or the card data: no thresholds, no card
// names, so expansions and new kingdoms need no changes.

const emptyPlayer = () => ({
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  inPlaySourceIndices: [],
});

/** The most valuable fixed-VP card in this kingdom, the natural unit for a lead */
function biggestVictoryCard(
  state: GameState,
): { name: string; vp: number } | undefined {
  return Object.entries(CARDS)
    .filter(([name]) => name in state.supply)
    .flatMap(([, card]) =>
      typeof card.vp === "number" && card.vp > 0
        ? [{ name: card.name, vp: card.vp }]
        : [],
    )
    .sort((a, b) => b.vp - a.vp)[0];
}

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
  const unit = biggestVictoryCard(state);
  const size =
    unit && Math.abs(lead) >= unit.vp
      ? `one ${unit.name} or more`
      : `${Math.abs(lead)} VP`;
  return lead > 0 ? `ahead by ${size}` : `behind by ${size}`;
}

/** Engine-proven: does any purchase available right now end the game */
function gameEndProximity(state: GameState) {
  const projections = purchaseConsequences(state);
  if (projections.length === 0) return "no purchase is being decided right now";
  return projections.some(p => p.triggersGameEnd)
    ? "at least one purchase available right now ends the game"
    : "no purchase available right now ends the game";
}

/** Named facts about the decision, computed once per state */
export function decisionSummary(state: GameState) {
  return {
    scorePosition: scorePosition(state),
    gameEnd: gameEndProximity(state),
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

// A card whose text names a supply pile that is empty cannot deliver that
// part of its effect. Works for any gainer or curser in any expansion.
function emptyPileNote(state: GameState, card: CardName): string | null {
  const text = CARDS[card].description;
  const emptyNamed = Object.entries(state.supply)
    .filter(([pile, count]) => count <= 0 && pile !== card)
    .map(([pile]) => pile)
    .filter(pile => new RegExp(`\\b${pile}\\b`, "i").test(text));
  if (emptyNamed.length === 0) return null;
  return `The ${emptyNamed.join(" and ")} pile is empty, so the part of this card that gives ${emptyNamed.join(" or ")} does nothing.`;
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
