import { z } from "zod";
import { CARDS } from "../data/cards";
import type { CardName, GameState, PlayerId } from "../types/game-state";
import type { DecisionChoice, PendingChoice } from "../types/pending-choice";
import type { GameEvent } from "../events/types";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type ChoiceRequest = Extract<PendingChoice, { choiceType: "decision" }>;
export type EffectTrigger =
  | { type: "play" }
  | { type: "attack"; target: PlayerId }
  | { type: "reaction"; attacker: PlayerId; attackCard: CardName };
export type EffectContext = {
  state: Omit<
    GameState,
    "pendingChoice" | "pendingChoiceEventId" | "executionStack" | "log"
  >;
  playerId: PlayerId;
  card: CardName;
  trigger: EffectTrigger;
  random: () => number;
};
export type EffectInput<M> =
  | { type: "start" }
  | { type: "answer"; memory: M; answer: DecisionChoice }
  | { type: "continue"; memory: M };
export type CardOperation =
  | {
      type: "play";
      card: CardName;
      playerId: PlayerId;
      from: "hand" | "discard";
      times?: number;
    }
  | { type: "attack"; targets: PlayerId[] };
export type EffectStep<M extends JsonValue = JsonValue> =
  | { type: "done"; events: GameEvent[]; blockAttack?: boolean }
  | { type: "choice"; events: GameEvent[]; request: ChoiceRequest; memory: M }
  | {
      type: "schedule";
      events: GameEvent[];
      operations: CardOperation[];
      continuation?: M;
    };

/** One execution contract. The schema validates saved local state before use. */
export type CardEffect = {
  run: (context: EffectContext, input: EffectInput<JsonValue>) => EffectStep;
  parseMemory: (value: unknown) => JsonValue;
};

export function defineEffect<M extends JsonValue>(
  schema: z.ZodType<M>,
  handler: (context: EffectContext, input: EffectInput<M>) => EffectStep<M>,
): CardEffect {
  return {
    parseMemory: value => schema.parse(value),
    run: (context, input) =>
      handler(
        context,
        input.type === "start"
          ? input
          : { ...input, memory: schema.parse(input.memory) },
      ),
  };
}
export const done = (
  events: GameEvent[] = [],
  blockAttack?: boolean,
): EffectStep<never> => ({
  type: "done",
  events,
  ...(blockAttack !== undefined && { blockAttack }),
});
export const choose = <M extends JsonValue>(
  request: ChoiceRequest,
  memory: M,
  events: GameEvent[] = [],
): EffectStep<M> => ({ type: "choice", events, request, memory });
export const schedule = <M extends JsonValue = never>(
  operations: CardOperation[],
  events: GameEvent[] = [],
  continuation?: M,
): EffectStep<M> => ({
  type: "schedule",
  events,
  operations,
  ...(continuation !== undefined && { continuation }),
});

export const noMemory = z.null();
export const cardNameSchema = z.custom<CardName>(
  value => typeof value === "string" && Object.hasOwn(CARDS, value),
);
