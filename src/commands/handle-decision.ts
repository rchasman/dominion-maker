import type { GameState, CardName } from "../types/game-state";
import type { CommandResult } from "./types";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import { generateEventId } from "../events/id-generator";
import { EventBuilder, linkEvents } from "../events/event-builder";
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

function handleThroneRoomExecution(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  throneRoomTarget: CardName,
  executionsRemaining: number,
): GameEvent[] {
  const midState = applyEvents(ctx.state, baseEvents);
  const targetEffect = getCardEffect(throneRoomTarget);
  if (!targetEffect) return baseEvents;

  const result = targetEffect({
    state: midState,
    playerId: ctx.state.activePlayerId,
    card: throneRoomTarget,
  });

  const newEvents: GameEvent[] = [
    ...baseEvents,
    {
      type: "CARD_PLAYED",
      playerId: ctx.state.activePlayerId,
      card: throneRoomTarget,
      sourceIndex: -1,
      id: generateEventId(),
      causedBy: ctx.originalCause || ctx.rootEventId,
    },
    ...linkEvents(result.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (result.pendingChoice) {
    return [
      ...newEvents,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingChoice,
          metadata: {
            ...result.pendingChoice.metadata,
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
    playerId: ctx.state.activePlayerId,
    card: throneRoomTarget,
  });
  const withSecond = [
    ...newEvents,
    ...linkEvents(secondResult.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (secondResult.pendingChoice) {
    return [
      ...withSecond,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...secondResult.pendingChoice,
          metadata: {
            ...secondResult.pendingChoice.metadata,
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

type ReactionMetadata = {
  attackCard: CardName;
  attacker: PlayerId;
  allTargets: PlayerId[];
  currentTargetIndex: number;
  blockedTargets: PlayerId[];
};

function extractReactionMetadata(
  ctx: DecisionContext,
): ReactionMetadata & { currentTarget: PlayerId } | null {
  const allTargets = (ctx.metadata?.allTargets as PlayerId[]) || [];
  const currentTargetIndex = (ctx.metadata?.currentTargetIndex as number) || 0;
  const blockedTargets = (ctx.metadata?.blockedTargets as PlayerId[]) || [];
  const attackCard =
    (ctx.metadata?.attackCard as CardName) || ctx.cardBeingPlayed;
  const attacker =
    (ctx.metadata?.attacker as PlayerId) || ctx.state.activePlayerId;
  const currentTarget = allTargets[currentTargetIndex];

  if (!currentTarget) return null;

  return {
    attackCard,
    attacker,
    allTargets,
    currentTargetIndex,
    blockedTargets,
    currentTarget,
  };
}

function createReactionEvents(
  choice: DecisionChoice,
  metadata: ReactionMetadata & { currentTarget: string },
  causedBy: string,
): { events: GameEvent[]; updatedBlockedTargets: string[] } {
  const revealedReaction = choice.cardActions?.["0"] === "reveal";

  if (revealedReaction && choice.selectedCards.length > 0) {
    const reactionCard = choice.selectedCards[0];
    if (!reactionCard) {
      return {
        events: [
          {
            type: "ATTACK_RESOLVED",
            attacker: metadata.attacker,
            target: metadata.currentTarget,
            attackCard: metadata.attackCard,
            blocked: false,
            id: generateEventId(),
            causedBy,
          },
        ],
        updatedBlockedTargets: metadata.blockedTargets,
      };
    }
    return {
      events: [
        {
          type: "REACTION_PLAYED",
          playerId: metadata.currentTarget,
          card: reactionCard,
          triggerEventId: "",
          id: generateEventId(),
          causedBy,
        },
        {
          type: "ATTACK_RESOLVED",
          attacker: metadata.attacker,
          target: metadata.currentTarget,
          attackCard: metadata.attackCard,
          blocked: true,
          id: generateEventId(),
          causedBy,
        },
      ],
      updatedBlockedTargets: [
        ...metadata.blockedTargets,
        metadata.currentTarget,
      ],
    };
  }

  return {
    events: [
      {
        type: "ATTACK_RESOLVED",
        attacker: metadata.attacker,
        target: metadata.currentTarget,
        attackCard: metadata.attackCard,
        blocked: false,
        id: generateEventId(),
        causedBy,
      },
    ],
    updatedBlockedTargets: metadata.blockedTargets,
  };
}

function processNextTarget(
  ctx: DecisionContext,
  currentEvents: GameEvent[],
  metadata: ReactionMetadata,
  nextIndex: number,
): GameEvent[] | null {
  const nextTarget = metadata.allTargets[nextIndex];
  if (nextTarget === undefined) return null;

  const midState = applyEvents(ctx.state, currentEvents);
  const reactions = getAvailableReactions(midState, nextTarget, "on_attack");

  if (reactions.length > 0) {
    const decisionEvent: GameEvent = {
      type: "DECISION_REQUIRED",
      decision: {
        choiceType: "decision",
        playerId: nextTarget,
        from: "hand",
        prompt: `${metadata.attacker} played ${metadata.attackCard}. Reveal a reaction?`,
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
        cardBeingPlayed: metadata.attackCard,
        stage: "__auto_reaction__",
        metadata: {
          attackCard: metadata.attackCard,
          attacker: metadata.attacker,
          allTargets: metadata.allTargets,
          currentTargetIndex: nextIndex,
          blockedTargets: metadata.blockedTargets,
          originalCause: ctx.originalCause,
        },
      },
      id: generateEventId(),
      causedBy: ctx.originalCause || ctx.rootEventId,
    };
    return [...currentEvents, decisionEvent];
  }

  const autoResolveEvent: GameEvent = {
    type: "ATTACK_RESOLVED",
    attacker: metadata.attacker,
    target: nextTarget,
    attackCard: metadata.attackCard,
    blocked: false,
    id: generateEventId(),
    causedBy: ctx.originalCause || ctx.rootEventId,
  };

  return (
    handleAutoReaction(
      {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          currentTargetIndex: nextIndex,
          blockedTargets: metadata.blockedTargets,
        },
      },
      [...currentEvents, autoResolveEvent],
      { selectedCards: [] },
    ) || [...currentEvents, autoResolveEvent]
  );
}

function applyAttackToResolvedTargets(
  ctx: DecisionContext,
  currentEvents: GameEvent[],
  metadata: ReactionMetadata,
): GameEvent[] {
  const resolvedTargets = metadata.allTargets.filter(
    t => !metadata.blockedTargets.includes(t),
  );
  const midState = applyEvents(ctx.state, currentEvents);

  const effect = getCardEffect(metadata.attackCard);
  if (!effect) return currentEvents;

  const result = effect({
    state: midState,
    playerId: metadata.attacker,
    card: metadata.attackCard,
    attackTargets: resolvedTargets,
  });

  const eventsWithAttack = [
    ...currentEvents,
    ...linkEvents(result.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (result.pendingChoice) {
    return [
      ...eventsWithAttack,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingChoice,
          metadata: {
            ...result.pendingChoice.metadata,
            originalCause: ctx.originalCause || ctx.rootEventId,
          },
        },
        id: generateEventId(),
        causedBy: ctx.originalCause || ctx.rootEventId,
      },
    ];
  }

  return eventsWithAttack;
}

function handleAutoReaction(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  choice: DecisionChoice,
): GameEvent[] | null {
  if (!ctx.stage?.startsWith("__auto_reaction__")) return null;

  const metadata = extractReactionMetadata(ctx);
  if (!metadata) return null;
  const { events: reactionEvents, updatedBlockedTargets } =
    createReactionEvents(
      choice,
      metadata,
      ctx.originalCause || ctx.rootEventId,
    );

  const currentEvents = [...baseEvents, ...reactionEvents];
  const updatedMetadata = {
    ...metadata,
    blockedTargets: updatedBlockedTargets,
  };

  const nextIndex = metadata.currentTargetIndex + 1;
  if (nextIndex < metadata.allTargets.length) {
    return processNextTarget(ctx, currentEvents, updatedMetadata, nextIndex);
  }

  return applyAttackToResolvedTargets(ctx, currentEvents, updatedMetadata);
}

function handleCardEffectContinuation(
  ctx: DecisionContext,
  baseEvents: GameEvent[],
  choice: DecisionChoice,
): GameEvent[] {
  // Reactions are now handled by handle-reaction.ts, not here
  if (!ctx.cardBeingPlayed) return baseEvents;

  const effect = getCardEffect(ctx.cardBeingPlayed);
  if (!effect) return baseEvents;

  const midState = applyEvents(ctx.state, baseEvents);
  const effectState: GameState = {
    ...midState,
    pendingChoice: {
      choiceType: "decision",
      playerId: ctx.decisionPlayer,
      from: "hand",
      prompt: "",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: ctx.cardBeingPlayed,
      ...(ctx.stage !== undefined && { stage: ctx.stage }),
      ...(ctx.metadata !== undefined && { metadata: ctx.metadata }),
    },
  };

  const result = effect({
    state: effectState,
    playerId: ctx.state.activePlayerId,
    card: ctx.cardBeingPlayed,
    decision: choice,
    ...(ctx.stage !== undefined && { stage: ctx.stage }),
  });
  const newEvents = [
    ...baseEvents,
    ...linkEvents(result.events, ctx.originalCause || ctx.rootEventId),
  ];

  if (result.pendingChoice) {
    return [
      ...newEvents,
      {
        type: "DECISION_REQUIRED",
        decision: {
          ...result.pendingChoice,
          cardBeingPlayed: ctx.cardBeingPlayed,
          metadata: {
            ...result.pendingChoice.metadata,
            originalCause: ctx.originalCause || ctx.rootEventId,
          },
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
  playerId: PlayerId,
  choice: DecisionChoice,
): CommandResult {
  if (!state.pendingChoice) {
    return { ok: false, error: "No pending decision" };
  }
  if (state.pendingChoice.choiceType !== "decision") {
    return { ok: false, error: "Pending choice is not a decision" };
  }
  if (state.pendingChoice.playerId !== playerId) {
    return { ok: false, error: "Not your decision" };
  }

  const {
    playerId: decisionPlayer,
    cardBeingPlayed,
    stage,
    metadata,
  } = state.pendingChoice;
  const originalCause = metadata?.originalCause as string | undefined;

  const builder = new EventBuilder();
  // Link DECISION_RESOLVED to the DECISION_REQUIRED that created it
  builder.add(
    {
      type: "DECISION_RESOLVED",
      playerId,
      choice,
    },
    state.pendingChoiceEventId || undefined,
  );
  const rootEventId = builder.getRootId();
  const baseEvents = builder.build();

  const ctx: DecisionContext = {
    state,
    decisionPlayer,
    cardBeingPlayed,
    stage,
    metadata,
    originalCause,
    rootEventId,
  };

  const throneRoomTarget = metadata?.throneRoomTarget as CardName | undefined;
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

export function handleSkipDecision(
  state: GameState,
  playerId: PlayerId,
): CommandResult {
  if (!state.pendingChoice) {
    return { ok: false, error: "No pending decision" };
  }
  if (state.pendingChoice.choiceType !== "decision") {
    return { ok: false, error: "Pending choice is not a decision" };
  }
  if (state.pendingChoice.playerId !== playerId) {
    return { ok: false, error: "Not your decision" };
  }
  if ((state.pendingChoice.min ?? 1) !== 0) {
    return { ok: false, error: "Cannot skip this decision" };
  }

  const {
    playerId: decisionPlayer,
    cardBeingPlayed,
    stage,
    metadata,
  } = state.pendingChoice;
  const originalCause = metadata?.originalCause as string | undefined;

  // Build DECISION_SKIPPED event (always emit this)
  const builder = new EventBuilder();
  builder.add(
    {
      type: "DECISION_SKIPPED",
      playerId,
      cardBeingPlayed,
      stage,
    },
    state.pendingChoiceEventId || undefined,
  );
  const rootEventId = builder.getRootId();
  const skipEvent = builder.build();

  // If there's a card being played, invoke its "on_skip" handler
  if (!cardBeingPlayed) {
    return { ok: true, events: skipEvent };
  }

  const effect = getCardEffect(cardBeingPlayed);
  if (!effect) {
    return { ok: true, events: skipEvent };
  }

  // Call card effect with original state (still has pendingChoice)
  const result = effect({
    state,
    playerId: decisionPlayer,
    card: cardBeingPlayed,
    decision: { selectedCards: [] },
    stage: "on_skip",
  });

  if (result.pendingChoice) {
    return { ok: false, error: "Cannot create decision from skip handler" };
  }

  // Link effect events to originalCause (the CARD_PLAYED event)
  const effectEvents = linkEvents(result.events, originalCause || rootEventId);

  return { ok: true, events: [...skipEvent, ...effectEvents] };
}
