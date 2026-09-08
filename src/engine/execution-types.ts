import type { CardName, PlayerId } from "../types/basic-types";
import type { PendingChoice } from "../types/pending-choice";

/** Card-authored work. The runner owns movement, repetition and interruptions. */
export type CardOperation = {
  type: "play";
  card: CardName;
  playerId: PlayerId;
  from: "hand" | "discard";
  times?: number;
};

export type CardFrame = {
  type: "effect";
  card: CardName;
  playerId: PlayerId;
  cause: string;
  attackTargets?: PlayerId[];
  part?: "benefit";
  choice?: Extract<PendingChoice, { choiceType: "decision" }>;
};

/** Plain data only: a suspended stack survives JSON round trips and replay. */
export type ExecutionFrame =
  | CardFrame
  | (CardOperation & { cause: string })
  | {
      type: "attack";
      card: CardName;
      playerId: PlayerId;
      cause: string;
      targets: PlayerId[];
      index: number;
      blocked: PlayerId[];
    };
