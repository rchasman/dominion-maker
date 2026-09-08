import type { GameState, PlayerId } from "../types/game-state";
import type { DecisionChoice } from "../events/types";
import type { CommandResult } from "./types";
import { resumeExecution } from "../engine/resume";

/** Validate the offered contract once, before any effect or movement occurs. */
export function handleSubmitDecision(
  state: GameState,
  playerId: PlayerId,
  choice: DecisionChoice,
  random: () => number = Math.random,
): CommandResult {
  const pending = state.pendingChoice;
  if (!pending) return { ok: false, error: "No pending decision" };
  if (pending.choiceType !== "decision")
    return { ok: false, error: "Pending choice is not a decision" };
  if (pending.playerId !== playerId)
    return { ok: false, error: "Not your decision" };
  if (
    !choice ||
    !Array.isArray(choice.selectedCards) ||
    (choice.cardOrder !== undefined && !Array.isArray(choice.cardOrder)) ||
    (choice.cardActions !== undefined &&
      (choice.cardActions === null ||
        typeof choice.cardActions !== "object" ||
        Array.isArray(choice.cardActions)))
  ) {
    return { ok: false, error: "Invalid decision response" };
  }
  if (
    choice.choiceId !== undefined &&
    choice.choiceId !== state.pendingChoiceEventId
  )
    return { ok: false, error: "Stale decision" };
  const available = [...pending.cardOptions];
  for (const card of choice.selectedCards) {
    const index = available.indexOf(card);
    if (index < 0)
      return { ok: false, error: "Card not available in this decision" };
    available.splice(index, 1);
  }
  if (!pending.actions?.length) {
    if (
      choice.selectedCards.length < (pending.min ?? 0) ||
      choice.selectedCards.length > (pending.max ?? pending.cardOptions.length)
    ) {
      return { ok: false, error: "Invalid number of selected cards" };
    }
    if (
      Object.keys(choice.cardActions ?? {}).length ||
      choice.cardOrder?.length
    )
      return { ok: false, error: "Unexpected card actions or ordering" };
  } else {
    for (const [key, action] of Object.entries(choice.cardActions ?? {})) {
      const index = Number(key);
      if (
        !Number.isInteger(index) ||
        String(index) !== key ||
        index < 0 ||
        index >= pending.cardOptions.length ||
        !pending.actions.some(option => option.id === action)
      ) {
        return { ok: false, error: "Invalid card action" };
      }
    }
    const order = choice.cardOrder ?? [];
    if (
      order.length &&
      (!pending.requiresOrdering ||
        new Set(order).size !== order.length ||
        order.some(
          index =>
            typeof index !== "number" ||
            !Number.isInteger(index) ||
            index < 0 ||
            index >= pending.cardOptions.length ||
            (choice.cardActions?.[index] ??
              pending.actions?.find(a => a.isDefault)?.id) !== "topdeck_card",
        ))
    ) {
      return { ok: false, error: "Invalid card ordering" };
    }
  }
  return { ok: true, events: resumeExecution(state, { choice }, random) };
}

export function handleSkipDecision(
  state: GameState,
  playerId: PlayerId,
  random: () => number = Math.random,
): CommandResult {
  const pending = state.pendingChoice;
  if (!pending) return { ok: false, error: "No pending decision" };
  if (pending.choiceType !== "decision")
    return { ok: false, error: "Pending choice is not a decision" };
  if (pending.playerId !== playerId)
    return { ok: false, error: "Not your decision" };
  if ((pending.min ?? 1) !== 0)
    return { ok: false, error: "Cannot skip this decision" };
  return {
    ok: true,
    events: resumeExecution(
      state,
      { choice: { selectedCards: [] }, skip: true },
      random,
    ),
  };
}
