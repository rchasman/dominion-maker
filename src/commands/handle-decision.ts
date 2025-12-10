import type { GameState, CardName } from "../types/game-state";
import type { CommandResult } from "./types";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import { generateEventId } from "../events/id-generator";

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

function handleCardEffectContinuation(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  choice: DecisionChoice,
): GameEvent[] {
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
