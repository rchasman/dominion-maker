import type { GameState, CardName } from "../types/game-state";
import type { CommandResult } from "./types";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import { generateEventId } from "../events/id-generator";
import { getAvailableReactions } from "../cards/effect-types";

type DecisionContext = {
  state: GameState;
  decisionPlayer: PlayerId;
  cardBeingPlayed: CardName | undefined;
  stage: string | undefined;
  metadata: Record<string, unknown> | undefined;
  originalCause: string | undefined;
  rootEventId: string;
};

function linkEffectEvents(events: GameEvent[], causedBy: string): GameEvent[] {
  return events.map(event => ({
    ...event,
    id: generateEventId(),
    causedBy,
  }));
}

function handleThroneRoomExecution(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  throneRoomTarget: string,
  executionsRemaining: number,
): GameEvent[] {
  const midState = applyEvents(ctx.state, baseEvents);
  const targetEffect = getCardEffect(throneRoomTarget);
  if (!targetEffect) return baseEvents;

  const result = targetEffect({
    state: midState,
    player: ctx.state.activePlayer,
    card: throneRoomTarget,
  });

  const newEvents: GameEvent[] = [
    ...baseEvents,
    {
      type: "CARD_PLAYED",
      player: ctx.state.activePlayer,
      card: throneRoomTarget,
    },
    ...linkEffectEvents(result.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (result.pendingDecision) {
    return [
      ...newEvents,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingDecision,
          metadata: {
            ...result.pendingDecision.metadata,
            throneRoomTarget,
            throneRoomExecutionsRemaining: executionsRemaining - 1,
          },
        },
        id: generateEventId(),
        causedBy: ctx.rootEventId,
      },
    ];
  }

  if (executionsRemaining <= 1) return newEvents;

  // Execute second time
  const secondMidState = applyEvents(midState, result.events);
  const secondResult = targetEffect({
    state: secondMidState,
    player: ctx.state.activePlayer,
    card: throneRoomTarget,
  });
  const withSecond = [
    ...newEvents,
    ...linkEffectEvents(
      secondResult.events,
      ctx.originalCause || ctx.rootEventId,
    ),
  ];

  if (secondResult.pendingDecision) {
    return [
      ...withSecond,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...secondResult.pendingDecision,
          metadata: {
            ...secondResult.pendingDecision.metadata,
            throneRoomTarget,
            throneRoomExecutionsRemaining: 0,
          },
        },
        id: generateEventId(),
        causedBy: ctx.rootEventId,
      },
    ];
  }
  return withSecond;
}

function handleAutoReaction(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  choice: DecisionChoice,
): GameEvent[] | null {
  if (!ctx.stage?.startsWith("__auto_reaction__")) return null;

  const allTargets = (ctx.metadata?.allTargets as string[]) || [];
  const currentTargetIndex = (ctx.metadata?.currentTargetIndex as number) || 0;
  const blockedTargets = (ctx.metadata?.blockedTargets as string[]) || [];
  const attackCard = (ctx.metadata?.attackCard as CardName) || ctx.cardBeingPlayed;
  const attacker = (ctx.metadata?.attacker as string) || ctx.state.activePlayer;
  const currentTarget = allTargets[currentTargetIndex];

  const events = [...baseEvents];

  // Did they reveal a reaction?
  const revealedReaction = choice.cardActions?.["0"] === "reveal";

  if (revealedReaction && choice.selectedCards.length > 0) {
    const reactionCard = choice.selectedCards[0];
    events.push(
      {
        type: "REACTION_PLAYED",
        player: currentTarget,
        card: reactionCard,
        triggerEventId: "", // Link to ATTACK_DECLARED
        id: generateEventId(),
        causedBy: ctx.originalCause || ctx.rootEventId,
      },
      {
        type: "ATTACK_RESOLVED",
        attacker,
        target: currentTarget,
        attackCard: attackCard!,
        blocked: true,
        id: generateEventId(),
        causedBy: ctx.originalCause || ctx.rootEventId,
      },
    );
    blockedTargets.push(currentTarget);
  } else {
    events.push({
      type: "ATTACK_RESOLVED",
      attacker,
      target: currentTarget,
      attackCard: attackCard!,
      blocked: false,
      id: generateEventId(),
      causedBy: ctx.originalCause || ctx.rootEventId,
    });
  }

  // Check next target
  const nextIndex = currentTargetIndex + 1;
  if (nextIndex < allTargets.length) {
    const nextTarget = allTargets[nextIndex];
    const midState = applyEvents(ctx.state, events);
    const reactions = getAvailableReactions(midState, nextTarget, "on_attack");

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
            { id: "reveal", label: "Reveal", color: "#10B981", isDefault: false },
            { id: "decline", label: "Don't Reveal", color: "#9CA3AF", isDefault: true },
          ],
          cardBeingPlayed: attackCard!,
          stage: "__auto_reaction__",
          metadata: {
            attackCard,
            attacker,
            allTargets,
            currentTargetIndex: nextIndex,
            blockedTargets,
            originalCause: ctx.originalCause,
          },
        },
        id: generateEventId(),
        causedBy: ctx.originalCause || ctx.rootEventId,
      });
      return events;
    }

    // No reaction for next target, auto-resolve
    events.push({
      type: "ATTACK_RESOLVED",
      attacker,
      target: nextTarget,
      attackCard: attackCard!,
      blocked: false,
      id: generateEventId(),
      causedBy: ctx.originalCause || ctx.rootEventId,
    });

    // Continue checking remaining targets recursively
    return handleAutoReaction(
      { ...ctx, metadata: { ...ctx.metadata, currentTargetIndex: nextIndex, blockedTargets } },
      events,
      { selectedCards: [] }, // Fake decline for recursion
    ) || events;
  }

  // All targets processed, apply attack to resolved targets
  const resolvedTargets = allTargets.filter(t => !blockedTargets.includes(t));
  const midState = applyEvents(ctx.state, events);

  const effect = getCardEffect(attackCard!);
  if (!effect) return events;

  const result = effect({
    state: midState,
    player: attacker,
    card: attackCard!,
    attackTargets: resolvedTargets,
  });

  events.push(...linkEffectEvents(result.events, ctx.originalCause || ctx.rootEventId));

  if (result.pendingDecision) {
    events.push({
      type: "DECISION_REQUIRED",
      decision: {
        ...result.pendingDecision,
        metadata: {
          ...result.pendingDecision.metadata,
          originalCause: ctx.originalCause || ctx.rootEventId,
        },
      },
      id: generateEventId(),
      causedBy: ctx.originalCause || ctx.rootEventId,
    });
  }

  return events;
}

function handleCardEffectContinuation(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  choice: DecisionChoice,
): GameEvent[] {
  // Check for auto-reaction first
  const reactionResult = handleAutoReaction(ctx, baseEvents, choice);
  if (reactionResult) return reactionResult;

  if (!ctx.cardBeingPlayed) return baseEvents;

  const effect = getCardEffect(ctx.cardBeingPlayed);
  if (!effect) return baseEvents;

  const midState = applyEvents(ctx.state, baseEvents);
  const effectState: GameState = {
    ...midState,
    pendingDecision: {
      type: "card_decision",
      player: ctx.decisionPlayer,
      from: "hand",
      prompt: "",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: ctx.cardBeingPlayed,
      stage: ctx.stage,
      metadata: ctx.metadata,
    },
  };

  const result = effect({
    state: effectState,
    player: ctx.state.activePlayer,
    card: ctx.cardBeingPlayed,
    decision: choice,
    stage: ctx.stage,
  });
  const newEvents = [
    ...baseEvents,
    ...linkEffectEvents(result.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (result.pendingDecision) {
    return [
      ...newEvents,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingDecision,
          cardBeingPlayed: ctx.cardBeingPlayed,
        },
        id: generateEventId(),
        causedBy: ctx.rootEventId,
      },
    ];
  }
  return newEvents;
}

export function handleSubmitDecision(
  state: GameState,
  player: PlayerId,
  choice: DecisionChoice,
): CommandResult {
  if (!state.pendingDecision) {
    return { ok: false, error: "No pending decision" };
  }
  if (state.pendingDecision.player !== player) {
    return { ok: false, error: "Not your decision" };
  }

  const {
    player: decisionPlayer,
    cardBeingPlayed,
    stage,
    metadata,
  } = state.pendingDecision;
  const originalCause = metadata?.originalCause as string | undefined;
  const rootEventId = generateEventId();
  const baseEvents: GameEvent[] = [
    { type: "DECISION_RESOLVED", player, choice, id: rootEventId },
  ];

  const ctx: DecisionContext = {
    state,
    decisionPlayer,
    cardBeingPlayed,
    stage,
    metadata,
    originalCause,
    rootEventId,
  };

  const throneRoomTarget = metadata?.throneRoomTarget as string | undefined;
  const executionsRemaining = metadata?.throneRoomExecutionsRemaining as
    | number
    | undefined;

  if (throneRoomTarget && executionsRemaining && executionsRemaining > 0) {
    const events = handleThroneRoomExecution(
      ctx,
      baseEvents,
      throneRoomTarget,
      executionsRemaining,
    );
    return { ok: true, events };
  }

  if (cardBeingPlayed) {
    const events = handleCardEffectContinuation(ctx, baseEvents, choice);
    return { ok: true, events };
  }

  return { ok: true, events: baseEvents };
}
