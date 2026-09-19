/** Priority-based rules bot: one command for the current state, any seat. */
import type { CardName, GameState, PlayerId } from "../types/game-state";
import type { GameCommand } from "../commands/types";
import type { PendingChoice } from "../types/pending-choice";
import { isDecisionChoice, isReactionChoice } from "../types/pending-choice";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";

type Decision = Extract<PendingChoice, { choiceType: "decision" }>;

const ACTION_PRIORITIES: Record<string, number> = {
  Village: 100,
  Festival: 95,
  Market: 90,
  Laboratory: 80,
  Smithy: 75,
  "Council Room": 70,
  Moat: 65,
  Witch: 60,
  Militia: 25,
  Moneylender: 45,
  Mine: 40,
  Workshop: 20,
  Remodel: 18,
  Chapel: 12,
};

const BUY_PRIORITY: CardName[] = [
  "Province",
  "Gold",
  "Duchy",
  "Laboratory",
  "Market",
  "Festival",
  "Silver",
  "Smithy",
  "Village",
  "Workshop",
  "Chapel",
  "Estate",
];

const DISCARD_PRIORITIES: CardName[] = [
  "Estate",
  "Duchy",
  "Province",
  "Curse",
  "Copper",
];

const TRASH_PRIORITIES: CardName[] = ["Curse", "Estate", "Copper"];

const sortActionsByPriority = (actions: CardName[]): CardName[] =>
  [...actions].sort(
    (a, b) => (ACTION_PRIORITIES[b] ?? 0) - (ACTION_PRIORITIES[a] ?? 0),
  );

const selectCardsByPriority = (
  options: CardName[],
  priorities: CardName[],
  count: number,
): CardName[] =>
  priorities.reduce<CardName[]>((acc, priority) => {
    if (acc.length >= count) return acc;
    const matching = options.filter(c => c === priority);
    return [...acc, ...matching.slice(0, count - acc.length)];
  }, []);

const fillRemainingCards = (
  options: CardName[],
  selected: CardName[],
  count: number,
  compareFn: (a: CardName, b: CardName) => number,
): CardName[] => {
  if (selected.length >= count) return selected;
  const remaining = options
    .filter(c => !selected.includes(c))
    .sort(compareFn)
    .slice(0, count - selected.length);
  return [...selected, ...remaining];
};

const findAffordableCard = (
  supply: Record<string, number>,
  coins: number,
): CardName | null =>
  BUY_PRIORITY.find(card => {
    const cardSupply = supply[card] ?? 0;
    return cardSupply > 0 && CARDS[card].cost <= coins;
  }) ?? null;

const costDescending = (a: CardName, b: CardName): number =>
  CARDS[b].cost - CARDS[a].cost;
const costAscending = (a: CardName, b: CardName): number =>
  CARDS[a].cost - CARDS[b].cost;

function chooseCards(decision: Decision): CardName[] {
  const options = decision.cardOptions;
  const count = decision.min ?? 0;
  if (decision.intent === "discard") {
    return fillRemainingCards(
      options,
      selectCardsByPriority(options, DISCARD_PRIORITIES, count),
      count,
      costDescending,
    );
  }
  if (decision.intent === "trash") {
    return fillRemainingCards(
      options,
      selectCardsByPriority(options, TRASH_PRIORITIES, count),
      count,
      costAscending,
    );
  }
  if (decision.intent === "gain") {
    return [...options].sort(costDescending).slice(0, count);
  }
  return count === 0 ? [] : options.slice(0, count);
}

function answerDecision(decision: Decision, playerId: PlayerId): GameCommand {
  const perCard = (decision.actions ?? []).filter(
    a => a.id !== "select" && a.id !== "skip",
  );
  const defaultAction = decision.actions?.find(a => a.isDefault);
  if (perCard.length > 0 && defaultAction) {
    const cardActions = Object.fromEntries(
      decision.cardOptions.map((_, index) => [index, defaultAction.id]),
    );
    const cardOrder =
      defaultAction.id === "topdeck_card"
        ? decision.cardOptions.map((_, index) => index)
        : [];
    return {
      type: "SUBMIT_DECISION",
      playerId,
      choice: { selectedCards: [], cardActions, cardOrder },
    };
  }
  return {
    type: "SUBMIT_DECISION",
    playerId,
    choice: { selectedCards: chooseCards(decision) },
  };
}

export function dominionHeuristic(
  state: GameState,
  playerId: PlayerId,
): GameCommand {
  const pending = state.pendingChoice;
  if (isReactionChoice(pending) && pending.playerId === playerId) {
    const moat = pending.availableReactions.find(card => card === "Moat");
    return moat
      ? { type: "REVEAL_REACTION", playerId, card: moat }
      : { type: "DECLINE_REACTION", playerId };
  }
  if (isDecisionChoice(pending) && pending.playerId === playerId) {
    return answerDecision(pending, playerId);
  }
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  if (state.phase === "action") {
    const [top] = sortActionsByPriority(player.hand.filter(isActionCard));
    return top && state.actions > 0
      ? { type: "PLAY_ACTION", playerId, card: top }
      : { type: "END_PHASE", playerId };
  }
  if (state.phase === "buy") {
    if (player.hand.some(isTreasureCard)) {
      return { type: "PLAY_ALL_TREASURES", playerId };
    }
    const card =
      state.buys > 0 ? findAffordableCard(state.supply, state.coins) : null;
    return card
      ? { type: "BUY_CARD", playerId, card }
      : { type: "END_PHASE", playerId };
  }
  return { type: "END_PHASE", playerId };
}
