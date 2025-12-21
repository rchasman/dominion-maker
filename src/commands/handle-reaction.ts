/**
 * Reaction command handlers (first-class, not decisions)
 * Extracted from handle-decision.ts to separate concerns
 */

import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { CommandResult } from "./types";
import type { GameEvent } from "../events/types";
import { generateEventId } from "../events/id-generator";
import { applyEvents } from "../events/apply";
import { getCardEffect } from "../cards/base";
import { getAvailableReactions } from "../cards/effect-types";
import { isReactionChoice } from "../types/pending-choice";

// Import generic ReactionContext from shared types
import type { ReactionContext } from "./reaction-types";

/**
 * Handle REVEAL_REACTION command
 */
export function handleRevealReaction(
  state: GameState,
  playerId: PlayerId,
  card: CardName,
): CommandResult {
  const reaction = state.pendingChoice;

  // Validation
  if (!isReactionChoice(reaction)) {
    return { ok: false, error: "No pending reaction" };
  }

  const metadata = reaction.metadata;
  if (!metadata) {
    return { ok: false, error: "Missing reaction metadata" };
  }

  if (reaction.playerId !== playerId) {
    return { ok: false, error: "Not your reaction to reveal" };
  }

  if (!reaction.availableReactions.includes(card)) {
    return { ok: false, error: "Card not available to reveal" };
  }

  // Generate events
  const rootEventId = state.pendingChoiceEventId || generateEventId();

  // REACTION_REVEALED event
  const revealedEvent: GameEvent = {
    type: "REACTION_REVEALED",
    playerId,
    card,
    triggeringCard: reaction.triggeringCard,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  // REACTION_PLAYED event (for animation/logging)
  const playedEvent: GameEvent = {
    type: "REACTION_PLAYED",
    playerId,
    card,
    triggerEventId: reaction.metadata!.originalCause,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  // ATTACK_RESOLVED (blocked: true)
  const resolvedEvent: GameEvent = {
    type: "ATTACK_RESOLVED",
    attacker: reaction.triggeringPlayerId,
    target: playerId,
    attackCard: reaction.triggeringCard,
    blocked: true,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  const baseEvents: GameEvent[] = [revealedEvent, playedEvent, resolvedEvent];

  // Update context for next target
  const updatedContext: ReactionContext = {
    triggeringCard: reaction.triggeringCard,
    triggeringPlayerId: reaction.triggeringPlayerId,
    triggerType: reaction.triggerType,
    ...reaction.metadata!,
    blockedTargets: [...reaction.metadata!.blockedTargets, playerId],
  };

  // Check if more targets need reactions
  const nextIndex = reaction.metadata!.currentTargetIndex + 1;
  if (nextIndex < reaction.metadata!.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      updatedContext,
      nextIndex,
      reaction.metadata!.originalCause,
    );
    const eventsWithNext = [...baseEvents, ...nextEvents];

    // If there's another REACTION_OPPORTUNITY, don't apply attack yet (waiting for next reaction)
    const hasMoreReactions = nextEvents.some(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    if (!hasMoreReactions) {
      // All reactions resolved, apply attack to unblocked targets
      const midState = applyEvents(state, eventsWithNext);
      const attackEvents = applyAttackToUnblockedTargets(
        midState,
        updatedContext,
        reaction.metadata!.originalCause,
      );
      return { ok: true, events: [...eventsWithNext, ...attackEvents] };
    }
    return { ok: true, events: eventsWithNext };
  }

  // All reactions resolved - apply attack to unblocked targets
  const midState = applyEvents(state, baseEvents);
  const attackEvents = applyAttackToUnblockedTargets(
    midState,
    updatedContext,
    reaction.metadata!.originalCause,
  );
  return { ok: true, events: [...baseEvents, ...attackEvents] };
}

/**
 * Handle DECLINE_REACTION command
 */
export function handleDeclineReaction(
  state: GameState,
  playerId: PlayerId,
): CommandResult {
  const reaction = state.pendingChoice;

  // Validation
  if (!isReactionChoice(reaction)) {
    return { ok: false, error: "No pending reaction" };
  }

  const metadata = reaction.metadata;
  if (!metadata) {
    return { ok: false, error: "Missing reaction metadata" };
  }

  if (reaction.playerId !== playerId) {
    return { ok: false, error: "Not your reaction to decline" };
  }

  // Generate events
  const rootEventId = state.pendingChoiceEventId || generateEventId();

  // REACTION_DECLINED event
  const declinedEvent: GameEvent = {
    type: "REACTION_DECLINED",
    playerId,
    triggeringCard: reaction.triggeringCard,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  // ATTACK_RESOLVED (blocked: false)
  const resolvedEvent: GameEvent = {
    type: "ATTACK_RESOLVED",
    attacker: reaction.triggeringPlayerId,
    target: playerId,
    attackCard: reaction.triggeringCard,
    blocked: false,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  const baseEvents: GameEvent[] = [declinedEvent, resolvedEvent];

  // Prepare full context for continuation
  const fullContext: ReactionContext = {
    triggeringCard: reaction.triggeringCard,
    triggeringPlayerId: reaction.triggeringPlayerId,
    triggerType: reaction.triggerType,
    ...reaction.metadata!,
  };

  // Check if more targets need reactions
  const nextIndex = reaction.metadata!.currentTargetIndex + 1;
  if (nextIndex < reaction.metadata!.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      fullContext,
      nextIndex,
      reaction.metadata!.originalCause,
    );
    const eventsWithNext = [...baseEvents, ...nextEvents];

    // If there's another REACTION_OPPORTUNITY, don't apply attack yet (waiting for next reaction)
    const hasMoreReactions = nextEvents.some(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    if (!hasMoreReactions) {
      // All reactions resolved, apply attack to unblocked targets
      const midState = applyEvents(state, eventsWithNext);
      const attackEvents = applyAttackToUnblockedTargets(
        midState,
        fullContext,
        reaction.metadata!.originalCause,
      );
      return { ok: true, events: [...eventsWithNext, ...attackEvents] };
    }
    return { ok: true, events: eventsWithNext };
  }

  // All reactions resolved - apply attack to unblocked targets
  const midState = applyEvents(state, baseEvents);
  const attackEvents = applyAttackToUnblockedTargets(
    midState,
    fullContext,
    fullContext.originalCause,
  );
  return { ok: true, events: [...baseEvents, ...attackEvents] };
}

/**
 * Process next target in multi-target attack
 */
function processNextTarget(
  state: GameState,
  context: ReactionContext,
  nextIndex: number,
  rootEventId: string,
): GameEvent[] {
  const nextTarget = context.allTargets[nextIndex];
  if (!nextTarget) return [];

  const reactions = getAvailableReactions(state, nextTarget, "on_attack");

  if (reactions.length > 0) {
    // Next target has reactions - create REACTION_OPPORTUNITY
    return [
      {
        type: "REACTION_OPPORTUNITY",
        playerId: nextTarget,
        triggeringPlayerId: context.triggeringPlayerId,
        triggeringCard: context.triggeringCard,
        triggerType: "on_attack",
        availableReactions: reactions,
        metadata: {
          ...context,
          currentTargetIndex: nextIndex,
        },
        id: generateEventId(),
        causedBy: rootEventId,
      },
    ];
  }

  // No reactions - auto-resolve this target and continue
  const resolvedEvent: GameEvent = {
    type: "ATTACK_RESOLVED",
    attacker: context.triggeringPlayerId,
    target: nextTarget,
    attackCard: context.triggeringCard,
    blocked: false,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  // Recursively check next target
  if (nextIndex + 1 < context.allTargets.length) {
    const nextState = applyEvents(state, [resolvedEvent]);
    const nextEvents = processNextTarget(
      nextState,
      context,
      nextIndex + 1,
      rootEventId,
    );
    return [resolvedEvent, ...nextEvents];
  }

  return [resolvedEvent];
}

/**
 * Apply attack effect to unblocked targets
 */
function applyAttackToUnblockedTargets(
  state: GameState,
  context: ReactionContext,
  rootEventId: string,
): GameEvent[] {
  const unblockedTargets = context.allTargets.filter(
    t => !context.blockedTargets.includes(t),
  );

  if (unblockedTargets.length === 0) {
    return []; // All targets blocked
  }

  // Get the attack card effect
  const effect = getCardEffect(context.triggeringCard);
  if (!effect) {
    return [];
  }

  // Call effect with filtered attackTargets
  const result = effect({
    state,
    playerId: context.triggeringPlayerId,
    card: context.triggeringCard,
    attackTargets: unblockedTargets,
  });

  // Link all events to root cause
  const linkedEvents = result.events.map(e => ({
    ...e,
    id: e.id || generateEventId(),
    causedBy: e.causedBy || rootEventId,
  }));

  // Handle pending choice from attack effect (e.g., Militia requiring discards)
  const pendingChoiceEvent: GameEvent[] = result.pendingChoice
    ? [
        {
          type: "DECISION_REQUIRED",
          decision: {
            ...result.pendingChoice,
            cardBeingPlayed: context.triggeringCard,
            metadata: {
              ...result.pendingChoice.metadata,
              originalCause: rootEventId,
            },
          },
          id: generateEventId(),
          causedBy: rootEventId,
        },
      ]
    : [];

  return [...linkedEvents, ...pendingChoiceEvent];
}
