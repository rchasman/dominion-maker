/** Decisions the LLM answers with several votes and one SUBMIT_DECISION. */
import type { CardName, GameState, PlayerId } from "../types/game-state";
import type { Action } from "../types/action";
import type { CompoundDecision } from "../core/game-definition";
import type { DominionShape } from "./shape";
import { isDecisionChoice } from "../types/pending-choice";
import { getLegalActions } from "../agent/legal-actions";

const withoutOne = (cards: readonly CardName[], card: CardName): CardName[] => {
  const idx = cards.indexOf(card);
  return idx === -1
    ? [...cards]
    : [...cards.slice(0, idx), ...cards.slice(idx + 1)];
};

const pickedCards = (picks: Action[]): CardName[] =>
  picks.flatMap(pick =>
    pick.type !== "choose_from_options" && pick.card ? [pick.card] : [],
  );

const endsRounds = (move: Action): boolean => move.type === "skip_decision";

export function dominionCompound(
  state: GameState,
  playerId: PlayerId,
): CompoundDecision<DominionShape> | null {
  const decision = state.pendingChoice;
  if (!isDecisionChoice(decision) || decision.playerId !== playerId) {
    return null;
  }

  const perCardActions = (decision.actions ?? []).filter(
    a => a.id !== "select" && a.id !== "skip",
  );
  if (perCardActions.length > 0) {
    const defaultAction = decision.actions?.find(a => a.isDefault);
    if (!defaultAction) {
      throw new Error("Multi-action decision requires default action");
    }
    const count = decision.cardOptions.length;
    const roundState = (index: number): GameState => ({
      ...state,
      pendingChoice: {
        ...decision,
        presentation: { ...decision.presentation, currentRoundIndex: index },
      },
    });
    return {
      round: picks => {
        if (picks.length >= count) return null;
        const next = roundState(picks.length);
        return { state: next, moves: getLegalActions(next) };
      },
      endsRounds,
      finish: picks => {
        const cardActions: Record<number, string> = Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            index,
            picks[index]?.type ?? defaultAction.id,
          ]),
        );
        const cardOrder = Object.entries(cardActions)
          .filter(([, id]) => id === "topdeck_card")
          .map(([index]) => Number(index));
        return {
          type: "SUBMIT_DECISION",
          playerId,
          choice: { selectedCards: [], cardActions, cardOrder },
        };
      },
    };
  }

  const max = decision.max ?? 1;
  if (max <= 1) return null;
  return {
    round: picks => {
      if (picks.length >= max) return null;
      const remaining = pickedCards(picks).reduce(
        withoutOne,
        decision.cardOptions,
      );
      if (remaining.length === 0) return null;
      const next: GameState = {
        ...state,
        pendingChoice: { ...decision, cardOptions: remaining },
      };
      return { state: next, moves: getLegalActions(next) };
    },
    endsRounds,
    finish: picks => ({
      type: "SUBMIT_DECISION",
      playerId,
      choice: { selectedCards: pickedCards(picks) },
    }),
  };
}
