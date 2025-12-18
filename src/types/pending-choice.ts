import type { CardName, PlayerId } from "./game-state";

export type CardActionId =
  | "trash_card"
  | "discard_card"
  | "topdeck_card"
  | "gain_card";

export type CardAction = {
  id: CardActionId;
  label: string;
  color: string;
  isDefault?: boolean;
};

/**
 * Unified type for all player choices (decisions and reactions).
 * Uses discriminated union for type safety.
 */
export type PendingChoice =
  | {
      choiceType: "decision";
      playerId: PlayerId;
      prompt: string;
      cardOptions: CardName[];
      cardBeingPlayed: CardName;
      // Simple selection mode
      from?: "hand" | "supply" | "revealed" | "options" | "discard";
      min?: number;
      max?: number;
      stage?: string;
      // Complex multi-action mode
      actions?: CardAction[];
      requiresOrdering?: boolean;
      orderingPrompt?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      choiceType: "reaction";
      playerId: PlayerId;
      attacker: PlayerId;
      attackCard: CardName;
      availableReactions: CardName[];
      metadata: {
        allTargets: PlayerId[];
        currentTargetIndex: number;
        blockedTargets: PlayerId[];
        originalCause: string;
      };
    };

/**
 * Type guards for narrowing PendingChoice
 */
export function isDecisionChoice(
  choice: PendingChoice | null | undefined,
): choice is Extract<PendingChoice, { choiceType: "decision" }> {
  return choice?.choiceType === "decision";
}

export function isReactionChoice(
  choice: PendingChoice | null | undefined,
): choice is Extract<PendingChoice, { choiceType: "reaction" }> {
  return choice?.choiceType === "reaction";
}

export type DecisionChoice = {
  selectedCards: CardName[];
  cardActions?: Record<string | number, string>;
  cardOrder?: (CardName | number)[];
};
