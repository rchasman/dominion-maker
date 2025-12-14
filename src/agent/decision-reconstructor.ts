import type { DominionEngine } from "../engine/engine";
import type {
  DecisionChoice,
  CardName,
  DecisionRequest,
} from "../types/game-state";
import type { Action } from "../types/action";
import { agentLogger } from "../lib/logger";
import { run } from "../lib/run";

/**
 * Helper functions for multi-round consensus decision reconstruction.
 * Batch reconstruction (Chapel/Cellar) is implemented inline in game-agent.ts.
 * Multi-action reconstruction (Sentry/Library) uses reconstructMultiActionDecision.
 */

/**
 * Simulate a card selection without emitting events.
 * Used to provide context for multi-round consensus voting.
 *
 * This creates a temporary engine state with the selected card removed,
 * allowing the next consensus round to see "what if I already selected this card".
 */
export function simulateCardSelection(
  engine: DominionEngine,
  card: CardName,
): DominionEngine {
  const state = { ...engine.state };
  const decision = state.pendingDecision;

  if (!decision) return engine;

  // Update card options to remove selected card
  // This prevents AI from voting for the same card twice
  const updatedOptions = decision.cardOptions.filter(c => c !== card);

  return {
    ...engine,
    state: {
      ...state,
      pendingDecision: {
        ...decision,
        cardOptions: updatedOptions,
      },
    },
  };
}

/**
 * Check if a decision is batch-capable (requires reconstruction).
 */
export function isBatchDecision(decision: DecisionRequest | null | undefined): boolean {
  return !!decision && decision.type === "card_decision" && decision.max > 1;
}

/**
 * Check if a decision has custom actions per card (like Sentry).
 * These require multi-round consensus where AI votes on each card individually.
 */
export function isMultiActionDecision(
  decision: DecisionRequest | null | undefined,
): boolean {
  return !!(
    decision?.actions &&
    decision.actions.length > 0 &&
    !decision.actions.every(a => a.id === "select" || a.id === "skip")
  );
}

/**
 * Reconstruct a multi-action decision (like Sentry) from atomic actions.
 * Each atomic action specifies what to do with one card.
 *
 * Example: Sentry reveals [Copper, Estate]
 * - Round 1: AI votes "trash Copper" -> cardActions[0] = "trash"
 * - Round 2: AI votes "topdeck Estate" -> cardActions[1] = "topdeck"
 * - Result: { selectedCards: [], cardActions: {0: "trash", 1: "topdeck"}, cardOrder: [1] }
 */
export async function reconstructMultiActionDecision(
  initialEngine: DominionEngine,
  atomicActions: Action[],
): Promise<DecisionChoice> {
  const decision = initialEngine.state.pendingDecision;
  if (!decision) throw new Error("No pending decision for reconstruction");

  const cardActions: Record<number, string> = {};
  const numCards = decision.cardOptions.length;

  agentLogger.info(
    `Reconstructing multi-action decision: ${numCards} cards, ${atomicActions.length} actions`,
  );

  // Process one action per card
  for (let i = 0; i < Math.min(atomicActions.length, numCards); i++) {
    const action = atomicActions[i];

    if (action.type === "skip_decision") {
      agentLogger.debug(
        `AI voted to skip after ${i} decisions, applying defaults`,
      );
      const defaultAction = decision.actions?.find(a => a.isDefault);
      if (!defaultAction) {
        throw new Error("Decision has no default action - cannot skip");
      }

      for (let j = i; j < numCards; j++) {
        if (!(j in cardActions)) {
          cardActions[j] = defaultAction.id;
        }
      }
      break;
    }

    cardActions[i] = action.type;

    agentLogger.debug(
      `Card ${i} (${decision.cardOptions[i]}): ${action.type}`,
    );
  }

  // Build cardOrder: topdecked cards in the order they appear
  const cardOrder = Object.entries(cardActions)
    .filter(([, actionId]) => actionId === "topdeck_card")
    .map(([index]) => parseInt(index));

  agentLogger.info(
    `Multi-action reconstructed: ${Object.keys(cardActions).length} actions, ${cardOrder.length} topdecked`,
  );

  return { selectedCards: [], cardActions, cardOrder };
}
