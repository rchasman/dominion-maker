import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CardFrame, ExecutionFrame } from "./execution-types";
import { applyEvent, applyEvents } from "../events/apply";
import { generateEventId } from "../events/id-generator";
import { getCardEffect } from "../cards/base";
import { CARDS } from "../data/cards";
import { getAvailableReactions } from "../cards/effect-types";

/** Run until there is a real choice or no work remains. Last frame runs first. */
function execute(
  initialState: GameState,
  initialStack: ExecutionFrame[],
  random: () => number,
  response?:
    | { choice: DecisionChoice; skip?: boolean }
    | { reaction: CardName | null },
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
  const scheduleAttack = (frame: CardFrame) => {
    const targets = state.playerOrder.filter(id => id !== frame.playerId);
    emit(
      {
        type: "ATTACK_DECLARED",
        attacker: frame.playerId,
        attackCard: frame.card,
        targets,
      },
      frame.cause,
    );
    stack.push({
      type: "attack",
      card: frame.card,
      playerId: frame.playerId,
      cause: frame.cause,
      targets,
      index: 0,
      blocked: [],
    });
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
      // Repetition re-executes an effect without moving a second physical card.
      for (let i = 0; i < (frame.times ?? 1); i++) {
        stack.push({
          type: "effect",
          playerId: frame.playerId,
          card: frame.card,
          cause,
        });
      }
      continue;
    }

    if (frame.type === "attack") {
      let blocked = [...frame.blocked];
      let index = frame.index;
      if (response && "reaction" in response) {
        const target = frame.targets[index]!;
        const card = response.reaction;
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
          emit(
            {
              type: "REACTION_PLAYED",
              playerId: target,
              card,
              triggerEventId: frame.cause,
            },
            frame.cause,
          );
          blocked = [...blocked, target];
        } else {
          emit(
            {
              type: "REACTION_DECLINED",
              playerId: target,
              triggeringCard: frame.card,
            },
            state.pendingChoiceEventId ?? frame.cause,
          );
        }
        emit(
          {
            type: "ATTACK_RESOLVED",
            attacker: frame.playerId,
            target,
            attackCard: frame.card,
            blocked: card !== null,
          },
          frame.cause,
        );
        index++;
        response = undefined;
      }
      let waiting = false;
      for (; index < frame.targets.length; index++) {
        const target = frame.targets[index]!;
        const reactions = getAvailableReactions(state, target, "on_attack");
        if (reactions.length) {
          stack.push({ ...frame, index, blocked });
          emit(
            {
              type: "REACTION_OPPORTUNITY",
              playerId: target,
              triggeringPlayerId: frame.playerId,
              triggeringCard: frame.card,
              triggerType: "on_attack",
              availableReactions: reactions,
              metadata: {
                allTargets: frame.targets,
                currentTargetIndex: index,
                blockedTargets: blocked,
                originalCause: frame.cause,
              },
            },
            frame.cause,
          );
          waiting = true;
          break;
        }
        emit(
          {
            type: "ATTACK_RESOLVED",
            attacker: frame.playerId,
            target,
            attackCard: frame.card,
            blocked: false,
          },
          frame.cause,
        );
      }
      if (waiting) break;
      stack.push({
        type: "effect",
        card: frame.card,
        playerId: frame.playerId,
        cause: frame.cause,
        attackTargets: frame.targets.filter(id => !blocked.includes(id)),
      });
      continue;
    }

    const effect = getCardEffect(frame.card);
    if (
      !frame.choice &&
      !frame.part &&
      frame.attackTargets === undefined &&
      CARDS[frame.card]?.triggers?.length
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
    if (
      !frame.choice &&
      !frame.part &&
      frame.attackTargets === undefined &&
      effect?.attack
    ) {
      scheduleAttack(frame);
      stack.push({ ...frame, part: "benefit" });
      continue;
    }
    let decision: DecisionChoice | undefined;
    if (frame.choice) {
      if (!response || !("choice" in response))
        throw new Error("Missing choice response");
      decision = response.choice;
      const cause = state.pendingChoiceEventId ?? undefined;
      emit(
        response.skip
          ? {
              type: "DECISION_SKIPPED",
              playerId: frame.choice.playerId,
              cardBeingPlayed: frame.card,
              ...(frame.choice.stage !== undefined && {
                stage: frame.choice.stage,
              }),
            }
          : {
              type: "DECISION_RESOLVED",
              playerId: frame.choice.playerId,
              choice: decision,
            },
        cause,
      );
      response = undefined;
    }
    if (!effect) continue;
    const handler =
      frame.part === "benefit"
        ? (effect.benefit ?? effect)
        : frame.attackTargets !== undefined
          ? (effect.attack ?? effect)
          : effect;
    const result = handler({
      random,
      state: frame.choice ? { ...state, pendingChoice: frame.choice } : state,
      playerId: frame.playerId,
      card: frame.card,
      ...(decision !== undefined && { decision }),
      ...(frame.choice?.stage !== undefined && { stage: frame.choice.stage }),
      ...(frame.attackTargets !== undefined && {
        attackTargets: frame.attackTargets,
      }),
    });
    if (result.pendingChoice && result.operations?.length)
      throw new Error(
        "A card step must request a choice or schedule child work, not both",
      );
    for (const event of result.events) emit(event, frame.cause);
    if (result.pendingChoice) {
      stack.push({ ...frame, choice: result.pendingChoice });
      emit(
        { type: "DECISION_REQUIRED", decision: result.pendingChoice },
        frame.cause,
      );
    }
    for (const operation of [...(result.operations ?? [])].reverse()) {
      stack.push({ ...operation, cause: frame.cause });
    }
    if (result.pendingChoice) break;
  }
  if (stack.length || initialState.executionStack?.length) {
    emit(
      { type: "EXECUTION_UPDATED", stack },
      initialStack.at(-1)?.cause ?? events[0]?.id ?? generateEventId(),
    );
  }
  return events;
}

export function executeCard(
  state: GameState,
  playerId: PlayerId,
  card: CardName,
  cause: string,
  random: () => number = Math.random,
): GameEvent[] {
  return execute(state, [{ type: "effect", playerId, card, cause }], random);
}

export function resumeExecution(
  state: GameState,
  response:
    | { choice: DecisionChoice; skip?: boolean }
    | { reaction: CardName | null },
  random: () => number = Math.random,
): GameEvent[] {
  let stack = state.executionStack;
  // Old event logs and standalone card fixtures have no execution checkpoint.
  // Their pending choice still describes the single suspended card.
  if (!stack?.length) {
    const pending = state.pendingChoice;
    if (!pending) return [];
    if (
      pending.choiceType === "decision" &&
      pending.stage === "execute_throned_card"
    ) {
      const card = pending.metadata?.throneRoomTarget as CardName | undefined;
      const count = pending.metadata?.throneRoomExecutionsRemaining;
      const cause = state.pendingChoiceEventId ?? generateEventId();
      const resolved: GameEvent = {
        type: "DECISION_RESOLVED",
        playerId: pending.playerId,
        choice: { selectedCards: [] },
        id: generateEventId(),
        causedBy: cause,
      };
      const work: ExecutionFrame[] =
        card && typeof count === "number" && count > 0
          ? [
              {
                type: "play",
                playerId: state.activePlayerId,
                card,
                from: "hand",
                times: count,
                cause,
              },
            ]
          : [];
      return [
        resolved,
        ...execute(applyEvents(state, [resolved]), work, random),
      ];
    }
    if (pending.choiceType === "reaction") {
      stack = [
        {
          type: "attack",
          card: pending.triggeringCard,
          playerId: pending.triggeringPlayerId,
          cause: pending.metadata.originalCause,
          targets: pending.metadata.allTargets,
          index: pending.metadata.currentTargetIndex,
          blocked: pending.metadata.blockedTargets,
        },
      ];
      const benefit = getCardEffect(pending.triggeringCard)?.benefit;
      if (benefit) {
        const initial = benefit({
          state,
          playerId: pending.triggeringPlayerId,
          card: pending.triggeringCard,
          random,
        });
        const events = initial.events.map(event => ({
          ...event,
          id: generateEventId(),
          causedBy: pending.metadata.originalCause,
        }));
        return [
          ...events,
          ...execute(applyEvents(state, events), stack, random, response),
        ];
      }
    } else {
      stack = [
        {
          type: "effect",
          card: pending.cardBeingPlayed,
          playerId: state.activePlayerId,
          cause:
            typeof pending.metadata?.originalCause === "string"
              ? pending.metadata.originalCause
              : (state.pendingChoiceEventId ?? generateEventId()),
          choice: pending,
        },
      ];
      const remaining = pending.metadata?.throneRoomExecutionsRemaining;
      const repeatedCard = pending.metadata?.throneRoomTarget as
        | CardName
        | undefined;
      if (repeatedCard && typeof remaining === "number" && remaining > 0) {
        stack.unshift(
          ...Array.from(
            { length: remaining },
            (): CardFrame => ({
              type: "effect",
              playerId: state.activePlayerId,
              card: repeatedCard,
              cause: stack![0]!.cause,
            }),
          ),
        );
      }
    }
  }
  return execute(state, stack, random, response);
}
