import type { ModelProvider } from "../../config/models";
import type { TokenUsage } from "./cost";

type LLMLogEntryType =
  | "ai-turn-start"
  | "error"
  | "consensus-start"
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
  /** Tokens this model billed for the decision, when the transport reported them */
  usage?: TokenUsage;
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

/** Transport that asks one model for one move; the endpoint numbers the moves */
export type DecideMoveFor<S, M> = (input: {
  provider: ModelProvider;
  state: S;
  actionId: string;
  playerStrategies: Record<string, unknown>;
  customStrategy: string;
  signal: AbortSignal;
}) => Promise<{
  move: M;
  distribution: WeightedVote<M>[];
  usage?: TokenUsage;
}>;
