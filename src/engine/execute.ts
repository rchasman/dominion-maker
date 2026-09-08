import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { ExecutionFrame } from "./execution-types";
import type { CardEffect, EffectInput, JsonValue } from "../cards/program";
import { applyEvent } from "../events/apply";
import { generateEventId } from "../events/id-generator";
import { getCardEffect } from "../cards/base";
import { CARDS } from "../data/cards";
import { getAvailableReactions } from "../cards/effect-types";

export type ExecutionResponse =
  | { choice: DecisionChoice; skip?: boolean }
  | { reaction: CardName | null };
export type EffectRegistry = (card: CardName) => CardEffect | undefined;

/** The only execution loop. Frames contain rules data; requests live in the view. */
export function runExecution(
  initialState: GameState,
  initialStack: ExecutionFrame[],
  random: () => number,
  response?: ExecutionResponse,
  lookup: EffectRegistry = getCardEffect,
): GameEvent[] {
  let state = initialState;
  const stack = [...initialStack];
  const events: GameEvent[] = [];
  const emit = (event: GameEvent, cause?: string): string => {
    const linked = {
      ...event,
      id: generateEventId(),
      ...(cause !== undefined && { causedBy: cause }),
    };
    events.push(linked);
    state = applyEvent(state, linked);
    return linked.id;
  };
  while (stack.length) {
    const frame = stack.pop()!;
    if (frame.type === "play") {
      const source = state.players[frame.playerId]?.[frame.from];
      if (!source?.includes(frame.card)) continue;
      const cause = emit(
        {
          type: "CARD_PLAYED",
          playerId: frame.playerId,
          card: frame.card,
          from: frame.from,
          sourceIndex: source.indexOf(frame.card),
        },
        frame.cause,
      );
      for (let i = 0; i < (frame.times ?? 1); i++)
        stack.push({
          type: "effect",
          card: frame.card,
          playerId: frame.playerId,
          trigger: { type: "play" },
          cause,
        });
      continue;
    }
    if (frame.type === "attack") {
      if (frame.phase === "declare") {
        emit(
          {
            type: "ATTACK_DECLARED",
            attacker: frame.playerId,
            attackCard: frame.card,
            targets: frame.targets,
          },
          frame.cause,
        );
        if (frame.targets.length) stack.push({ ...frame, phase: "react" });
        continue;
      }
      const target = frame.targets[frame.index];
      if (!target) continue;
      if (
        frame.phase === "react" ||
        (frame.phase === "afterReaction" && !frame.blocked)
      ) {
        if (response && "reaction" in response) {
          const card = response.reaction;
          response = undefined;
          if (card) {
            emit(
              {
                type: "REACTION_REVEALED",
                playerId: target,
                card,
                triggeringCard: frame.card,
              },
              state.pendingChoiceEventId ?? frame.cause,
            );
            const cause = emit(
              {
                type: "REACTION_PLAYED",
                playerId: target,
                card,
                triggerEventId: frame.cause,
              },
              frame.cause,
            );
            stack.push({ ...frame, phase: "afterReaction" });
            stack.push({
              type: "effect",
              card,
              playerId: target,
              cause,
              trigger: {
                type: "reaction",
                attacker: frame.playerId,
                attackCard: frame.card,
              },
            });
            continue;
          }
          emit(
            {
              type: "REACTION_DECLINED",
              playerId: target,
              triggeringCard: frame.card,
            },
            state.pendingChoiceEventId ?? frame.cause,
          );
        } else {
          const availableReactions = getAvailableReactions(
            state,
            target,
            "on_attack",
          );
          if (availableReactions.length) {
            stack.push({ ...frame, phase: "react" });
            emit(
              {
                type: "REACTION_OPPORTUNITY",
                playerId: target,
                triggeringPlayerId: frame.playerId,
                triggeringCard: frame.card,
                triggerType: "on_attack",
                availableReactions,
              },
              frame.cause,
            );
            break;
          }
        }
      }
      emit(
        {
          type: "ATTACK_RESOLVED",
          attacker: frame.playerId,
          target,
          attackCard: frame.card,
          blocked: frame.blocked,
        },
        frame.cause,
      );
      if (frame.index + 1 < frame.targets.length)
        stack.push({
          ...frame,
          index: frame.index + 1,
          phase: "react",
          blocked: false,
        });
      if (!frame.blocked)
        stack.push({
          type: "effect",
          card: frame.card,
          playerId: frame.playerId,
          cause: frame.cause,
          trigger: { type: "attack", target },
        });
      continue;
    }
    const effect = lookup(frame.card);
    if (!effect) throw new Error(`No effect registered for ${frame.card}`);
    let input: EffectInput<JsonValue> = { type: "start" };
    if (frame.type === "choice") {
      if (!response || !("choice" in response))
        throw new Error("Missing choice response");
      input = { type: "answer", memory: frame.memory, answer: response.choice };
      const playerId = state.pendingChoice?.playerId;
      if (!playerId) throw new Error("Missing pending choice");
      emit(
        response.skip
          ? { type: "DECISION_SKIPPED", playerId, cardBeingPlayed: frame.card }
          : { type: "DECISION_RESOLVED", playerId, choice: response.choice },
        state.pendingChoiceEventId ?? undefined,
      );
      response = undefined;
    } else if (frame.type === "continue") {
      input = { type: "continue", memory: frame.memory };
    } else if (
      frame.trigger.type === "play" &&
      CARDS[frame.card].triggers?.length
    ) {
      emit(
        {
          type: "TRIGGER_REGISTERED",
          playerId: frame.playerId,
          source: frame.card,
        },
        frame.cause,
      );
    }
    const result = effect.run(
      {
        state,
        playerId: frame.playerId,
        card: frame.card,
        trigger: frame.trigger,
        random,
      },
      input,
    );
    for (const event of result.events) emit(event, frame.cause);
    if (result.type === "choice") {
      stack.push({
        type: "choice",
        card: frame.card,
        playerId: frame.playerId,
        cause: frame.cause,
        trigger: frame.trigger,
        memory: effect.parseMemory(result.memory),
      });
      emit(
        { type: "DECISION_REQUIRED", decision: result.request },
        frame.cause,
      );
      break;
    }
    if (result.type === "done" && result.blockAttack) {
      if (frame.trigger.type !== "reaction")
        throw new Error("Only a reaction can block an attack");
      let index = stack.length - 1;
      while (index >= 0) {
        const item = stack[index];
        if (
          item?.type === "attack" &&
          item.phase === "afterReaction" &&
          item.targets[item.index] === frame.playerId
        )
          break;
        index--;
      }
      const attack = stack[index];
      if (!attack || attack.type !== "attack")
        throw new Error("No attack to block");
      stack[index] = { ...attack, blocked: true };
    }
    if (result.type === "schedule") {
      if (result.continuation !== undefined)
        stack.push({
          type: "continue",
          card: frame.card,
          playerId: frame.playerId,
          cause: frame.cause,
          trigger: frame.trigger,
          memory: effect.parseMemory(result.continuation),
        });
      for (const operation of [...result.operations].reverse()) {
        if (operation.type === "play")
          stack.push({ ...operation, cause: frame.cause });
        else {
          stack.push({
            type: "attack",
            card: frame.card,
            playerId: frame.playerId,
            cause: frame.cause,
            targets: operation.targets,
            index: 0,
            phase: "declare",
            blocked: false,
          });
        }
      }
    }
  }
  emit({ type: "EXECUTION_UPDATED", stack }, initialStack.at(-1)?.cause);
  return events;
}

export function executeCard(
  state: GameState,
  playerId: PlayerId,
  card: CardName,
  cause: string,
  random: () => number = Math.random,
): GameEvent[] {
  return runExecution(
    state,
    [{ type: "effect", playerId, card, cause, trigger: { type: "play" } }],
    random,
  );
}
