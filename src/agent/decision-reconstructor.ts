import type { DominionEngine } from "../engine/engine";
import type {
  DecisionChoice,
  CardName,
  DecisionRequest,
  GameState,
} from "../types/game-state";
import type { Action } from "../types/action";
import { agentLogger } from "../lib/logger";
import { removeCards } from "../lib/card-array-utils";

/**
 * Accumulate AI atomic actions voted on by consensus into a batch decision.
 * Used when batch decisions (max > 1) are decomposed for MAKER voting.
 *
 * This function is called by the consensus loop - after each atomic action is
 * selected by consensus, we accumulate it and update the simulated state for
 * the next voting round.
 */
export async function reconstructBatchDecision(
  initialEngine: DominionEngine,
  atomicActions: Action[],
): Promise<DecisionChoice> {
  const decision = initialEngine.state.pendingDecision;
  if (!decision) throw new Error("No pending decision for reconstruction");

  const { max } = decision;
  const selectedCards: CardName[] = [];
  let simulatedEngine = initialEngine;

  agentLogger.info(
    `Reconstructing batch decision: max=${max}, actions=${atomicActions.length}`,
  );

  // Accumulate actions up to max
  for (const action of atomicActions.slice(0, max)) {
    // Stop if AI votes to skip
    if (action.type === "skip_decision") {
      agentLogger.debug(`AI voted to skip after ${selectedCards.length} selections`);
      break;
    }

    // Extract card from atomic action
    const card = action.card;
    if (!card) {
      agentLogger.warn("Action missing card, stopping reconstruction");
      break;
    }

    selectedCards.push(card);

    // Simulate card removal for next round of voting
    simulatedEngine = simulateCardSelection(simulatedEngine, card);
  }

  agentLogger.info(`Batch reconstructed: ${selectedCards.length} cards selected`);
  return { selectedCards };
}

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
