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
 * Accumulate AI atomic actions via multi-round consensus voting.
 * Used when batch decisions (max > 1) are decomposed for MAKER voting.
 *
 * This runs consensus MULTIPLE times (up to max), with each round voting on
 * the next atomic action. The simulated state is updated between rounds so
 * AI sees the context of previous selections.
 *
 * @param runSingleConsensus - Function that runs one round of consensus voting
 * @param initialEngine - Engine state at decision start
 * @returns Full batch of selected cards to submit
 */
export async function reconstructBatchDecision(
  runSingleConsensus: (engine: DominionEngine) => Promise<Action>,
  initialEngine: DominionEngine,
): Promise<DecisionChoice> {
  const decision = initialEngine.state.pendingDecision;
  if (!decision) throw new Error("No pending decision for reconstruction");

  const { max } = decision;
  const selectedCards: CardName[] = [];
  let simulatedEngine = initialEngine;

  agentLogger.info(
    `Starting multi-round consensus for batch decision: max=${max}`,
  );

  // Run consensus up to max times
  for (let round = 0; round < max; round++) {
    agentLogger.debug(`Consensus round ${round + 1}/${max}`);

    // Run one round of consensus voting on decomposed actions
    const action = await runSingleConsensus(simulatedEngine);

    // Stop if AI votes to skip
    if (action.type === "skip_decision") {
      agentLogger.info(`AI voted to skip after ${selectedCards.length} selections`);
      break;
    }

    // Extract card from atomic action
    const card = action.card;
    if (!card) {
      agentLogger.warn("Action missing card, stopping reconstruction");
      break;
    }

    selectedCards.push(card);
    agentLogger.debug(`Round ${round + 1} selected: ${card}`);

    // Simulate card removal for next round of voting
    // This ensures AI sees updated context: "I already selected Copper"
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
      const defaultId = defaultAction?.id || "topdeck_card";

      for (let j = i; j < numCards; j++) {
        if (!(j in cardActions)) {
          cardActions[j] = defaultId;
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
