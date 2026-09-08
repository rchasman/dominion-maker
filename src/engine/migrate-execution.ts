import { z } from "zod";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { ExecutionFrame } from "./execution-types";
import type { ExecutionResponse } from "./execute";
import { cardNameSchema } from "../cards/program";
import { getCardEffect } from "../cards/base";
import { generateEventId } from "../events/id-generator";
import { executionStackSchema } from "./execution-schema";

// Historical wire formats belong at the persistence boundary, never in cards.
const metadata = z.object({
  originalCause: z.string().optional(),
  remainingOpponents: z.array(z.string()).default([]),
  attackingPlayer: z.string().optional(),
  revealed: z.array(cardNameSchema).optional(),
  revealedCards: z.array(cardNameSchema).optional(),
  skippedCards: z.array(cardNameSchema).default([]),
  discardedCard: cardNameSchema.optional(),
  throneRoomTarget: cardNameSchema.optional(),
  throneRoomExecutionsRemaining: z.number().int().nonnegative().optional(),
  allTargets: z.array(z.string()).optional(),
  currentTargetIndex: z.number().int().nonnegative().optional(),
  blockedTargets: z.array(z.string()).default([]),
});
const oldChoice = z.object({
  playerId: z.string(),
  cardBeingPlayed: cardNameSchema,
  cardOptions: z.array(cardNameSchema),
  stage: z.string().optional(),
  metadata: metadata.default({
    remainingOpponents: [],
    skippedCards: [],
    blockedTargets: [],
  }),
});
const oldFrame = z.object({
  type: z.enum(["effect", "play", "attack"]),
  card: cardNameSchema,
  playerId: z.string(),
  cause: z.string(),
  from: z.enum(["hand", "discard"]).optional(),
  times: z.number().int().positive().optional(),
  choice: oldChoice.optional(),
  attackTargets: z.array(z.string()).optional(),
  targets: z.array(z.string()).optional(),
  index: z.number().int().nonnegative().optional(),
  blocked: z.array(z.string()).default([]),
});

function choiceFrames(
  choice: z.infer<typeof oldChoice>,
  playerId: string,
  cause: string,
): ExecutionFrame[] {
  const { cardBeingPlayed: card, metadata: data } = choice;
  const effect = getCardEffect(card);
  if (!effect) throw new Error(`No saved choice handler for ${card}`);
  let memory: unknown = null;
  if (card === "Remodel" || card === "Mine" || card === "Artisan")
    memory = choice.stage;
  if (card === "Library")
    memory = { offered: choice.cardOptions[0], skipped: data.skippedCards };
  if (card === "Sentry") memory = { revealed: data.revealedCards };
  if (card === "Bandit") memory = { revealed: data.revealed };
  if (card === "Vassal")
    memory = { discarded: data.discardedCard ?? choice.cardOptions[0] };
  const attacker = data.attackingPlayer ?? playerId;
  const isAttack =
    card === "Militia" || card === "Bureaucrat" || card === "Bandit";
  const frames: ExecutionFrame[] = data.remainingOpponents
    .slice()
    .reverse()
    .map(target => ({
      type: "effect",
      card,
      playerId: attacker,
      cause,
      trigger: { type: "attack", target },
    }));
  frames.push({
    type: "choice",
    card,
    playerId: isAttack ? attacker : playerId,
    cause,
    trigger: isAttack
      ? { type: "attack", target: choice.playerId }
      : { type: "play" },
    memory: effect.parseMemory(memory),
  });
  return frames;
}

export function migrateExecution(
  state: GameState,
  response: ExecutionResponse,
  random: () => number,
): {
  stack: ExecutionFrame[];
  events: GameEvent[];
  response?: ExecutionResponse;
} {
  if (state.executionVersion === 2) {
    if (!state.executionStack?.length)
      throw new Error("Missing execution checkpoint");
    const stack = executionStackSchema.parse(state.executionStack);
    for (const frame of stack) {
      if (frame.type === "choice" || frame.type === "continue") {
        const effect = getCardEffect(frame.card);
        if (!effect)
          throw new Error(`No saved choice handler for ${frame.card}`);
        effect.parseMemory(frame.memory);
      }
    }
    return { stack, events: [], response };
  }
  if (state.executionVersion !== undefined)
    throw new Error("Unsupported execution checkpoint version");
  const events: GameEvent[] = [];
  let answer: ExecutionResponse | undefined = response;
  const convertAttack = (frame: z.infer<typeof oldFrame>): ExecutionFrame[] => {
    const targets = frame.targets ?? [];
    const index = frame.index ?? 0;
    const blocked = new Set(frame.blocked);
    if (answer && "reaction" in answer) {
      const target = targets[index];
      if (!target) throw new Error("Invalid saved attack target");
      const card = answer.reaction;
      const causedBy = state.pendingChoiceEventId ?? frame.cause;
      if (card) {
        // Moat was the only reaction supported by the historical format.
        if (card !== "Moat") throw new Error("Unsupported historical reaction");
        blocked.add(target);
        events.push(
          {
            type: "REACTION_REVEALED",
            playerId: target,
            card,
            triggeringCard: frame.card,
            causedBy,
            id: generateEventId(),
          },
          {
            type: "REACTION_PLAYED",
            playerId: target,
            card,
            triggerEventId: frame.cause,
            causedBy,
            id: generateEventId(),
          },
        );
      } else
        events.push({
          type: "REACTION_DECLINED",
          playerId: target,
          triggeringCard: frame.card,
          causedBy,
          id: generateEventId(),
        });
      answer = undefined;
    }
    return targets
      .flatMap((target, position): ExecutionFrame[] => {
        // Earlier reaction windows already emitted their resolution facts.
        // Their effects were deferred by the old runner, so resume only those.
        if (position < index)
          return blocked.has(target)
            ? []
            : [
                {
                  type: "effect",
                  card: frame.card,
                  playerId: frame.playerId,
                  cause: frame.cause,
                  trigger: { type: "attack", target },
                },
              ];
        return [
          {
            type: "attack",
            card: frame.card,
            playerId: frame.playerId,
            cause: frame.cause,
            targets: [target],
            index: 0,
            phase: position <= index ? "resolve" : "react",
            blocked: blocked.has(target),
          },
        ];
      })
      .reverse();
  };
  let stack: ExecutionFrame[];
  if (state.executionStack?.length) {
    stack = z
      .array(oldFrame)
      .parse(state.executionStack)
      .flatMap(frame => {
        if (frame.type === "play")
          return [
            {
              type: "play" as const,
              card: frame.card,
              playerId: frame.playerId,
              cause: frame.cause,
              from: frame.from ?? "hand",
              ...(frame.times !== undefined && { times: frame.times }),
            },
          ];
        if (frame.type === "attack") return convertAttack(frame);
        if (frame.choice)
          return choiceFrames(frame.choice, frame.playerId, frame.cause);
        if (frame.attackTargets)
          return frame.attackTargets
            .slice()
            .reverse()
            .map(target => ({
              type: "effect" as const,
              card: frame.card,
              playerId: frame.playerId,
              cause: frame.cause,
              trigger: { type: "attack" as const, target },
            }));
        return [
          {
            type: "effect" as const,
            card: frame.card,
            playerId: frame.playerId,
            cause: frame.cause,
            trigger: { type: "play" as const },
          },
        ];
      });
  } else {
    const pending = state.pendingChoice;
    if (!pending) throw new Error("Missing saved choice");
    if (pending.choiceType === "reaction") {
      const data = metadata.parse(Reflect.get(pending, "metadata"));
      const cause =
        data.originalCause ?? state.pendingChoiceEventId ?? generateEventId();
      const effect = getCardEffect(pending.triggeringCard);
      if (!effect) throw new Error("Missing saved attack");
      const benefit = effect.run(
        {
          state,
          playerId: pending.triggeringPlayerId,
          card: pending.triggeringCard,
          trigger: { type: "play" },
          random,
        },
        { type: "start" },
      );
      events.push(
        ...benefit.events.map(event => ({
          ...event,
          id: generateEventId(),
          causedBy: cause,
        })),
      );
      stack = convertAttack(
        oldFrame.parse({
          type: "attack",
          card: pending.triggeringCard,
          playerId: pending.triggeringPlayerId,
          cause,
          targets: data.allTargets,
          index: data.currentTargetIndex,
          blocked: data.blockedTargets,
        }),
      );
    } else {
      const choice = oldChoice.parse(pending);
      const cause =
        choice.metadata.originalCause ??
        state.pendingChoiceEventId ??
        generateEventId();
      const repeated = choice.metadata.throneRoomTarget;
      const count = choice.metadata.throneRoomExecutionsRemaining ?? 0;
      if (choice.stage === "execute_throned_card") {
        events.push({
          type: "DECISION_RESOLVED",
          playerId: choice.playerId,
          choice: { selectedCards: [] },
          id: generateEventId(),
          causedBy: cause,
        });
        stack =
          repeated && count > 0
            ? [
                {
                  type: "play",
                  card: repeated,
                  playerId: state.activePlayerId,
                  cause,
                  from: "hand",
                  times: count,
                },
              ]
            : [];
        answer = undefined;
      } else {
        stack = choiceFrames(choice, state.activePlayerId, cause);
        if (repeated)
          stack.unshift(
            ...Array.from(
              { length: count },
              (): ExecutionFrame => ({
                type: "effect",
                card: repeated,
                playerId: state.activePlayerId,
                cause,
                trigger: { type: "play" },
              }),
            ),
          );
      }
    }
  }
  return { stack, events, ...(answer && { response: answer }) };
}
