import type { PendingChoice } from "../types/pending-choice";
import { isReactionChoice } from "../types/pending-choice";
import { run } from "../lib/run";

/**
 * Project a PendingChoice into an AI-facing shape: keeps what the model
 * needs to decide (prompt, options, how many to pick) and drops UI
 * concerns (button labels, colors, defaults) and internal metadata.
 */
export function projectPendingChoiceForAI(
  choice: PendingChoice,
): Record<string, unknown> {
  if (isReactionChoice(choice)) {
    return {
      choiceType: "reaction",
      reactionTo: choice.triggeringCard,
      trigger: choice.triggerType,
      availableReactions: choice.availableReactions,
    };
  }

  const min = choice.min ?? 1;
  const max = choice.max ?? 1;

  const constraint = run(() => {
    if (min === max) {
      return `select exactly ${min} card${min === 1 ? "" : "s"}`;
    }
    if (min === 0) {
      return `select up to ${max} card${max === 1 ? "" : "s"} (skipping is allowed)`;
    }
    return `select between ${min} and ${max} cards`;
  });

  // Multi-action decisions (like Sentry) are voted one card at a time —
  // tell the model which card is currently being decided
  const roundIndex = choice.metadata?.currentRoundIndex;
  const multiRoundSection =
    typeof roundIndex === "number" && choice.cardOptions[roundIndex]
      ? {
          deciding: choice.cardOptions[roundIndex],
          progress: `card ${roundIndex + 1} of ${choice.cardOptions.length}`,
        }
      : {};

  return {
    choiceType: "decision",
    prompt: choice.prompt,
    cardBeingPlayed: choice.cardBeingPlayed,
    options: choice.cardOptions,
    constraint,
    ...(choice.from ? { source: choice.from } : {}),
    ...(choice.orderingPrompt ? { orderingPrompt: choice.orderingPrompt } : {}),
    ...multiRoundSection,
  };
}
