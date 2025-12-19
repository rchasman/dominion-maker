/**
 * Shared types for the generic reaction orchestration system.
 *
 * ## Reaction System Overview
 *
 * Dominion has multiple reaction triggers:
 * - on_attack: When another player plays an Attack card (Moat)
 * - on_gain: When you gain a card (Trader, Watchtower)
 * - on_trash: When you trash a card (Market Square)
 * - on_discard: When you discard a card (Tunnel)
 *
 * ## Architecture Pattern
 *
 * All reaction flows follow the same pattern:
 *
 * 1. **Trigger Orchestration** (trigger-specific files)
 *    - attack-orchestration.ts
 *    - gain-orchestration.ts (future)
 *    - trash-orchestration.ts (future)
 *    - discard-orchestration.ts (future)
 *
 * 2. **Reaction Resolution** (generic, shared)
 *    - handle-reaction.ts handles all trigger types
 *    - Processes REVEAL_REACTION and DECLINE_REACTION commands
 *    - Calls back to original action after reactions resolved
 *
 * ## Extending the System
 *
 * To add a new trigger type (e.g., on_gain for Trader):
 *
 * 1. Create gain-orchestration.ts:
 *    ```typescript
 *    export function orchestrateGain(config: GainOrchestrationConfig) {
 *      // Check for on_gain reactions
 *      const reactions = getAvailableReactions(state, player, "on_gain");
 *      if (reactions.length > 0) {
 *        return [createReactionOpportunityEvent({
 *          playerId: player,
 *          triggeringPlayer: player,
 *          triggeringCard: cardBeingGained,
 *          triggerType: "on_gain",
 *          context: { ... }
 *        })];
 *      }
 *      // Apply gain normally
 *    }
 *    ```
 *
 * 2. Add continuation callback in handle-reaction.ts:
 *    ```typescript
 *    case "on_gain":
 *      return applyGainToFinalDestination(state, context);
 *    ```
 *
 * That's it! The reaction reveal/decline logic is fully generic.
 */

import type { CardName, PlayerId } from "../types/game-state";
import type { ReactionTrigger } from "../data/cards";

/**
 * Complete context needed for reaction orchestration.
 * This is passed through REACTION_OPPORTUNITY events and reconstructed
 * by handle-reaction.ts to continue the original action.
 */
export interface ReactionContext {
  /** The card that triggered this reaction opportunity */
  triggeringCard: CardName;

  /** The player who triggered this reaction (played attack, gained card, etc.) */
  triggeringPlayer: PlayerId;

  /** What type of trigger caused this reaction */
  triggerType: ReactionTrigger;

  /** All players who might need to react (order matters for sequential processing) */
  allTargets: PlayerId[];

  /** Index of current target in allTargets (for sequential reaction processing) */
  currentTargetIndex: number;

  /** Players who successfully blocked/reacted (won't be affected by trigger) */
  blockedTargets: PlayerId[];

  /** Original event ID that started this flow (for causality tracking) */
  originalCause: string;
}

/**
 * Metadata specific to attack reactions.
 * Attacks are more complex than other triggers because they affect multiple opponents.
 */
export interface AttackReactionContext extends ReactionContext {
  triggerType: "on_attack";
}

/**
 * Helper to create initial reaction context for an attack.
 */
export function createAttackReactionContext(
  triggeringCard: CardName,
  triggeringPlayer: PlayerId,
  targets: PlayerId[],
  originalCause: string,
): AttackReactionContext {
  return {
    triggeringCard,
    triggeringPlayer,
    triggerType: "on_attack",
    allTargets: targets,
    currentTargetIndex: 0,
    blockedTargets: [],
    originalCause,
  };
}
