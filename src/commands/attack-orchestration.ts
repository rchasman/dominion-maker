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
import { run } from "../lib/run";

interface AttackOrchestrationConfig {
  state: GameState;
  attacker: PlayerId;
  attackCard: CardName;
  effect: CardEffect;
  rootEventId: string;
}

/**
 * Centralized attack orchestration: handles reaction flow and calls card effect with resolved targets.
 * Returns events including ATTACK_DECLARED, reaction decisions/resolutions, and card effect execution.
 */
export function orchestrateAttack(
  config: AttackOrchestrationConfig,
): GameEvent[] {
  const { state, attacker, attackCard, effect, rootEventId } = config;
  const opponents = state.playerOrder?.filter(p => p !== attacker) || [];
  const attackDeclaredEvent: GameEvent[] =
    opponents.length > 0
      ? [
          {
            type: "ATTACK_DECLARED",
            attacker,
            attackCard,
            targets: opponents,
            id: generateEventId(),
            causedBy: rootEventId,
          },
        ]
      : [];
  const events: GameEvent[] = [...attackDeclaredEvent];

  // Start reaction flow for first target
  const firstTarget = opponents[0];
  const reactionEvents = firstTarget
    ? run(() => {
        const reactions = getAvailableReactions(state, firstTarget, "on_attack");

        if (reactions.length > 0) {
          // Ask first target for reaction - continuation handled by handleAutoReaction
          const decisionEvent: GameEvent = {
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
          };
          return [decisionEvent];
        }

        // No reactions for first target, auto-resolve
        const resolvedEvent: GameEvent = {
          type: "ATTACK_RESOLVED",
          attacker,
          target: firstTarget,
          attackCard,
          blocked: false,
          id: generateEventId(),
          causedBy: rootEventId,
        };

        // Check remaining targets recursively via helper
        const remainingEvents = resolveRemainingTargets({
          state,
          attacker,
          attackCard,
          remainingTargets: opponents.slice(1),
          blockedTargets: [],
          rootEventId,
        });

        return [resolvedEvent, ...remainingEvents];
      })
    : [];

  const eventsWithReactions = [...events, ...reactionEvents];

  // If any reaction events include DECISION_REQUIRED, return early
  if (reactionEvents.some(e => e.type === "DECISION_REQUIRED")) {
    return eventsWithReactions;
  }

  // All reactions resolved, call card effect with resolved targets
  const midState = applyEvents(state, eventsWithReactions);
  const blockedTargets = eventsWithReactions
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

  const pendingDecisionEvent: GameEvent[] = attackResult.pendingDecision
    ? [
        {
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
        },
      ]
    : [];

  return [...eventsWithReactions, ...linkedEvents, ...pendingDecisionEvent];
}

interface ResolveRemainingTargetsConfig {
  state: GameState;
  attacker: PlayerId;
  attackCard: CardName;
  remainingTargets: PlayerId[];
  blockedTargets: PlayerId[];
  rootEventId: string;
}

/**
 * Helper: recursively resolve reactions for remaining targets.
 * Returns events and may include DECISION_REQUIRED if a target has reactions.
 */
function resolveRemainingTargets(
  config: ResolveRemainingTargetsConfig,
): GameEvent[] {
  const {
    state,
    attacker,
    attackCard,
    remainingTargets,
    blockedTargets,
    rootEventId,
  } = config;
  if (remainingTargets.length === 0) return [];

  const [nextTarget, ...rest] = remainingTargets;
  const reactions = getAvailableReactions(state, nextTarget, "on_attack");

  if (reactions.length > 0) {
    // Ask next target for reaction
    return [
      {
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
      },
    ];
  }

  // No reaction, auto-resolve and continue
  const resolvedEvent: GameEvent = {
    type: "ATTACK_RESOLVED",
    attacker,
    target: nextTarget,
    attackCard,
    blocked: false,
    id: generateEventId(),
    causedBy: rootEventId,
  };

  const recursiveEvents = resolveRemainingTargets({
    state,
    attacker,
    attackCard,
    remainingTargets: rest,
    blockedTargets,
    rootEventId,
  });

  return [resolvedEvent, ...recursiveEvents];
}
