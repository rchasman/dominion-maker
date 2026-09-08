import type { CardName, PlayerId } from "../types/basic-types";
import type { CardOperation, EffectTrigger, JsonValue } from "../cards/program";
export type { CardOperation } from "../cards/program";

export type Invocation = {
  card: CardName;
  playerId: PlayerId;
  cause: string;
  trigger: EffectTrigger;
};
export type ExecutionFrame =
  | (Invocation & { type: "effect" })
  | (Invocation & { type: "choice"; memory: JsonValue })
  | (Invocation & { type: "continue"; memory: JsonValue })
  | (Extract<CardOperation, { type: "play" }> & { cause: string })
  | {
      type: "attack";
      card: CardName;
      playerId: PlayerId;
      cause: string;
      targets: PlayerId[];
      index: number;
      phase: "declare" | "react" | "afterReaction" | "resolve";
      blocked: boolean;
    };
