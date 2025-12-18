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
  if (!reaction) {
    return { ok: false, error: "No pending reaction" };
  }

  if (reaction.playerId !== playerId) {
    return { ok: false, error: "Not your reaction to reveal" };
  }

  if (!reaction.availableReactions.includes(card)) {
    return { ok: false, error: "Card not available to reveal" };
  }

  // Generate events
  const rootEventId = state.pendingChoiceEventId || generateEventId();
  const events: GameEvent[] = [];

  // REACTION_REVEALED event
  events.push({
    type: "REACTION_REVEALED",
    playerId,
    card,
    attackCard: reaction.attackCard,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // REACTION_PLAYED event (for animation/logging)
  events.push({
    type: "REACTION_PLAYED",
    playerId,
    card,
    triggerEventId: reaction.metadata.originalCause,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // ATTACK_RESOLVED (blocked: true)
  events.push({
    type: "ATTACK_RESOLVED",
    attacker: reaction.attacker,
    target: playerId,
    attackCard: reaction.attackCard,
    blocked: true,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // Update metadata for next target
  const updatedMetadata = {
    ...reaction.metadata,
    blockedTargets: [...reaction.metadata.blockedTargets, playerId],
  };

  // Check if more targets need reactions
  const nextIndex = reaction.metadata.currentTargetIndex + 1;
  if (nextIndex < reaction.metadata.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      updatedMetadata,
      nextIndex,
      reaction.metadata.originalCause,
    );
    events.push(...nextEvents);
  } else {
    // All reactions resolved - apply attack to unblocked targets
    const midState = applyEvents(state, events);
    const attackEvents = applyAttackToUnblockedTargets(
      midState,
      updatedMetadata,
      reaction.metadata.originalCause,
    );
    events.push(...attackEvents);
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
  if (!reaction) {
    return { ok: false, error: "No pending reaction" };
  }

  if (reaction.playerId !== playerId) {
    return { ok: false, error: "Not your reaction to decline" };
  }

  // Generate events
  const rootEventId = state.pendingChoiceEventId || generateEventId();
  const events: GameEvent[] = [];

  // REACTION_DECLINED event
  events.push({
    type: "REACTION_DECLINED",
    playerId,
    attackCard: reaction.attackCard,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // ATTACK_RESOLVED (blocked: false)
  events.push({
    type: "ATTACK_RESOLVED",
    attacker: reaction.attacker,
    target: playerId,
    attackCard: reaction.attackCard,
    blocked: false,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  // Check if more targets need reactions
  const nextIndex = reaction.metadata.currentTargetIndex + 1;
  if (nextIndex < reaction.metadata.allTargets.length) {
    const nextEvents = processNextTarget(
      state,
      reaction.metadata,
      nextIndex,
      reaction.metadata.originalCause,
    );
    events.push(...nextEvents);
  } else {
    // All reactions resolved - apply attack to unblocked targets
    const midState = applyEvents(state, events);
    const attackEvents = applyAttackToUnblockedTargets(
      midState,
      reaction.metadata,
      reaction.metadata.originalCause,
    );
    events.push(...attackEvents);
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
  const reactions = getAvailableReactions(state, nextTarget, "on_attack");

  if (reactions.length > 0) {
    // Next target has reactions - create REACTION_OPPORTUNITY
    return [
      {
        type: "REACTION_OPPORTUNITY",
        playerId: nextTarget,
        attacker: metadata.attacker,
        attackCard: metadata.attackCard,
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
  const resolvedEvents: GameEvent[] = [
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
    resolvedEvents.push(...nextEvents);
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
  return result.events.map(e => ({
    ...e,
    id: e.id || generateEventId(),
    causedBy: e.causedBy || rootEventId,
  }));
}
