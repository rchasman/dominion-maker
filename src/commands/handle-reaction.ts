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

type ReactionMetadata = {
  attackCard: CardName;
  attacker: PlayerId;
  allTargets: PlayerId[];
  currentTargetIndex: number;
  blockedTargets: PlayerId[];
  originalCause: string;
};

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
  let events: GameEvent[] = [];

  // REACTION_REVEALED event
  events = [
    ...events,
    {
      type: "REACTION_REVEALED",
      playerId,
      card,
      triggeringCard: reaction.attackCard,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // REACTION_PLAYED event (for animation/logging)
  events = [
    ...events,
    {
      type: "REACTION_PLAYED",
      playerId,
      card,
      triggerEventId: metadata.originalCause,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // ATTACK_RESOLVED (blocked: true)
  events = [
    ...events,
    {
      type: "ATTACK_RESOLVED",
      attacker: reaction.attacker,
      target: playerId,
      attackCard: reaction.attackCard,
      blocked: true,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // Update metadata for next target
  const updatedMetadata: ReactionMetadata = {
    attackCard: reaction.attackCard,
    attacker: reaction.attacker,
    ...metadata,
    blockedTargets: [...metadata.blockedTargets, playerId],
  };

  // Check if more targets need reactions
  const nextIndex = metadata.currentTargetIndex + 1;
  if (nextIndex < metadata.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      updatedMetadata,
      nextIndex,
      metadata.originalCause,
    );
    events = [...events, ...nextEvents];

    // If there's another REACTION_OPPORTUNITY, don't apply attack yet (waiting for next reaction)
    const hasMoreReactions = nextEvents.some(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    if (!hasMoreReactions) {
      // All reactions resolved, apply attack to unblocked targets
      const midState = applyEvents(state, events);
      const attackEvents = applyAttackToUnblockedTargets(
        midState,
        updatedMetadata,
        metadata.originalCause,
      );
      events = [...events, ...attackEvents];
    }
  } else {
    // All reactions resolved - apply attack to unblocked targets
    const midState = applyEvents(state, events);
    const attackEvents = applyAttackToUnblockedTargets(
      midState,
      updatedMetadata,
      metadata.originalCause,
    );
    events = [...events, ...attackEvents];
  }

  return { ok: true, events };
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
  let events: GameEvent[] = [];

  // REACTION_DECLINED event
  events = [
    ...events,
    {
      type: "REACTION_DECLINED",
      playerId,
      triggeringCard: reaction.attackCard,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // ATTACK_RESOLVED (blocked: false)
  events = [
    ...events,
    {
      type: "ATTACK_RESOLVED",
      attacker: reaction.attacker,
      target: playerId,
      attackCard: reaction.attackCard,
      blocked: false,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // Prepare metadata with attackCard included
  const fullMetadata: ReactionMetadata = {
    attackCard: reaction.attackCard,
    attacker: reaction.attacker,
    ...metadata,
  };

  // Check if more targets need reactions
  const nextIndex = metadata.currentTargetIndex + 1;
  if (nextIndex < metadata.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      fullMetadata,
      nextIndex,
      metadata.originalCause,
    );
    events = [...events, ...nextEvents];

    // If there's another REACTION_OPPORTUNITY, don't apply attack yet (waiting for next reaction)
    const hasMoreReactions = nextEvents.some(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    if (!hasMoreReactions) {
      // All reactions resolved, apply attack to unblocked targets
      const midState = applyEvents(state, events);
      const attackEvents = applyAttackToUnblockedTargets(
        midState,
        fullMetadata,
        metadata.originalCause,
      );
      events = [...events, ...attackEvents];
    }
  } else {
    // All reactions resolved - apply attack to unblocked targets
    const midState = applyEvents(state, events);
    const attackEvents = applyAttackToUnblockedTargets(
      midState,
      fullMetadata,
      metadata.originalCause,
    );
    events = [...events, ...attackEvents];
  }

  return { ok: true, events };
}

/**
 * Process next target in multi-target attack
 */
function processNextTarget(
  state: GameState,
  metadata: ReactionMetadata,
  nextIndex: number,
  rootEventId: string,
): GameEvent[] {
  const nextTarget = metadata.allTargets[nextIndex];
  if (!nextTarget) return [];

  const reactions = getAvailableReactions(state, nextTarget, "on_attack");

  if (reactions.length > 0) {
    // Next target has reactions - create REACTION_OPPORTUNITY
    return [
      {
        type: "REACTION_OPPORTUNITY",
        playerId: nextTarget,
        triggeringPlayerId: metadata.attacker,
        triggeringCard: metadata.attackCard,
        triggerType: "on_attack",
        availableReactions: reactions,
        metadata: {
          ...metadata,
          currentTargetIndex: nextIndex,
        },
        id: generateEventId(),
        causedBy: rootEventId,
      },
    ];
  }

  // No reactions - auto-resolve this target and continue
  let resolvedEvents: GameEvent[] = [
    {
      type: "ATTACK_RESOLVED",
      attacker: metadata.attacker,
      target: nextTarget,
      attackCard: metadata.attackCard,
      blocked: false,
      id: generateEventId(),
      causedBy: rootEventId,
    },
  ];

  // Recursively check next target
  if (nextIndex + 1 < metadata.allTargets.length) {
    const nextState = applyEvents(state, resolvedEvents);
    const nextEvents = processNextTarget(
      nextState,
      metadata,
      nextIndex + 1,
      rootEventId,
    );
    resolvedEvents = [...resolvedEvents, ...nextEvents];
  }

  return resolvedEvents;
}

/**
 * Apply attack effect to unblocked targets
 */
function applyAttackToUnblockedTargets(
  state: GameState,
  metadata: ReactionMetadata,
  rootEventId: string,
): GameEvent[] {
  const unblockedTargets = metadata.allTargets.filter(
    t => !metadata.blockedTargets.includes(t),
  );

  if (unblockedTargets.length === 0) {
    return []; // All targets blocked
  }

  // Get the attack card effect
  const effect = getCardEffect(metadata.attackCard);
  if (!effect) {
    return [];
  }

  // Call effect with filtered attackTargets
  const result = effect({
    state,
    playerId: metadata.attacker,
    card: metadata.attackCard,
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
            cardBeingPlayed: metadata.attackCard,
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
