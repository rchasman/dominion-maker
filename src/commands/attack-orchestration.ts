/**
 * Centralized attack/reaction flow orchestration.
 * Consolidates ~200 lines of duplicated logic from handle.ts.
 */

import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, PlayerId } from "../events/types";
import type { CardEffect } from "../cards/effect-types";
import { getAvailableReactions } from "../cards/effect-types";
import { generateEventId } from "../events/id-generator";
import { applyEvents } from "../events/apply";

/**
 * Centralized attack orchestration: handles reaction flow and calls card effect with resolved targets.
 * Returns events including ATTACK_DECLARED, reaction decisions/resolutions, and card effect execution.
 */
export function orchestrateAttack(
  state: GameState,
  attacker: PlayerId,
  attackCard: CardName,
  effect: CardEffect,
  rootEventId: string,
): GameEvent[] {
  const opponents = state.playerOrder?.filter(p => p !== attacker) || [];
  const events: GameEvent[] = [];

  // Emit ATTACK_DECLARED
  if (opponents.length > 0) {
    events.push({
      type: "ATTACK_DECLARED",
      attacker,
      attackCard,
      targets: opponents,
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  // Start reaction flow for first target
  const firstTarget = opponents[0];
  if (firstTarget) {
    const reactions = getAvailableReactions(state, firstTarget, "on_attack");

    if (reactions.length > 0) {
      // Ask first target for reaction - continuation handled by handleAutoReaction
      events.push({
        type: "DECISION_REQUIRED",
        decision: {
          type: "card_decision",
          player: firstTarget,
          from: "hand",
          prompt: `${attacker} played ${attackCard}. Reveal a reaction?`,
          cardOptions: reactions,
          actions: [
            {
              id: "reveal",
              label: "Reveal",
              color: "#10B981",
              isDefault: false,
            },
            {
              id: "decline",
              label: "Don't Reveal",
              color: "#9CA3AF",
              isDefault: true,
            },
          ],
          cardBeingPlayed: attackCard,
          stage: "__auto_reaction__",
          metadata: {
            attackCard,
            attacker,
            allTargets: opponents,
            currentTargetIndex: 0,
            blockedTargets: [],
            originalCause: rootEventId,
          },
        },
        id: generateEventId(),
        causedBy: rootEventId,
      });
      return events;
    }

    // No reactions for first target, auto-resolve
    events.push({
      type: "ATTACK_RESOLVED",
      attacker,
      target: firstTarget,
      attackCard,
      blocked: false,
      id: generateEventId(),
      causedBy: rootEventId,
    });

    // Check remaining targets recursively via helper
    const remainingEvents = resolveRemainingTargets(
      state,
      attacker,
      attackCard,
      opponents.slice(1),
      [],
      rootEventId,
    );
    events.push(...remainingEvents);

    // If any remaining events include DECISION_REQUIRED, return early
    if (remainingEvents.some(e => e.type === "DECISION_REQUIRED")) {
      return events;
    }
  }

  // All reactions resolved, call card effect with resolved targets
  const midState = applyEvents(state, events);
  const blockedTargets = events
    .filter(
      (e): e is GameEvent & { type: "ATTACK_RESOLVED"; blocked: true } =>
        e.type === "ATTACK_RESOLVED" && e.blocked,
    )
    .map(e => e.target);
  const resolvedTargets = opponents.filter(t => !blockedTargets.includes(t));

  const attackResult = effect({
    state: midState,
    player: attacker,
    card: attackCard,
    attackTargets: resolvedTargets,
  });

  const linkedEvents = attackResult.events.map(e => ({
    ...e,
    id: generateEventId(),
    causedBy: rootEventId,
  }));
  events.push(...linkedEvents);

  if (attackResult.pendingDecision) {
    events.push({
      type: "DECISION_REQUIRED",
      decision: {
        ...attackResult.pendingDecision,
        cardBeingPlayed: attackCard,
        metadata: {
          ...attackResult.pendingDecision.metadata,
          originalCause: rootEventId,
        },
      },
      id: generateEventId(),
      causedBy: rootEventId,
    });
  }

  return events;
}

/**
 * Helper: recursively resolve reactions for remaining targets.
 * Returns events and may include DECISION_REQUIRED if a target has reactions.
 */
function resolveRemainingTargets(
  state: GameState,
  attacker: PlayerId,
  attackCard: CardName,
  remainingTargets: PlayerId[],
  blockedTargets: PlayerId[],
  rootEventId: string,
): GameEvent[] {
  if (remainingTargets.length === 0) return [];

  const [nextTarget, ...rest] = remainingTargets;
  const reactions = getAvailableReactions(state, nextTarget, "on_attack");
  const events: GameEvent[] = [];

  if (reactions.length > 0) {
    // Ask next target for reaction
    events.push({
      type: "DECISION_REQUIRED",
      decision: {
        type: "card_decision",
        player: nextTarget,
        from: "hand",
        prompt: `${attacker} played ${attackCard}. Reveal a reaction?`,
        cardOptions: reactions,
        actions: [
          {
            id: "reveal",
            label: "Reveal",
            color: "#10B981",
            isDefault: false,
          },
          {
            id: "decline",
            label: "Don't Reveal",
            color: "#9CA3AF",
            isDefault: true,
          },
        ],
        cardBeingPlayed: attackCard,
        stage: "__auto_reaction__",
        metadata: {
          attackCard,
          attacker,
          allTargets: [nextTarget, ...rest],
          currentTargetIndex: 0,
          blockedTargets,
          originalCause: rootEventId,
        },
      },
      id: generateEventId(),
      causedBy: rootEventId,
    });
    return events;
  }

  // No reaction, auto-resolve and continue
  events.push({
    type: "ATTACK_RESOLVED",
    attacker,
    target: nextTarget,
    attackCard,
    blocked: false,
    id: generateEventId(),
    causedBy: rootEventId,
  });

  events.push(
    ...resolveRemainingTargets(
      state,
      attacker,
      attackCard,
      rest,
      blockedTargets,
      rootEventId,
    ),
  );
  return events;
}
