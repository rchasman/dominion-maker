import type { ModelProvider } from "../../config/models";

export type LLMLogEntryType =
  | "ai-turn-start"
  | "error"
  | "consensus-start"
  | "consensus-compare"
  | "consensus-step-error"
  | "consensus-voting"
  | "consensus-skipped"
  | "consensus-model-pending"
  | "consensus-model-complete"
  | "consensus-model-aborted"
  | "consensus-verdict"
  | "ai-decision-resolving";

export type LLMLogEntryInput = {
  type: LLMLogEntryType;
  message: string;
  data?: Record<string, unknown>;
};

export type LLMLogger = (entry: LLMLogEntryInput) => void;

export type WeightedVote<M> = { move: M; weight: number };

export type ModelResult<M> = {
  provider: ModelProvider;
  result: M | null;
  /** Probability mass per move; a text model's single pick is one vote of weight 1 */
  distribution: WeightedVote<M>[];
  error: unknown;
  duration: number;
};

export type VoteGroup<M> = {
  key: string;
  move: M;
  /** Models whose top pick is this move */
  voters: ModelProvider[];
  /** Summed weight, fractional when a voter spread its mass */
  count: number;
};
