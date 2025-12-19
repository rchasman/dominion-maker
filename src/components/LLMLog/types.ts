import type { ModelProvider } from "../../config/models";
import type { Action } from "../../types/action";
import type {
  CardName,
  Phase,
  PlayerId,
  TurnAction,
} from "../../types/game-state";

// Game state snapshot for diagnostics
export interface GameStateSnapshot {
  turn: number;
  phase: Phase;
  activePlayerId: PlayerId;
  actions: number;
  buys: number;
  coins: number;
  hand: CardName[];
  inPlay: CardName[];
  handCounts: {
    treasures: number;
    actions: number;
    total: number;
  };
  turnHistory: TurnAction[];
  legalActionsCount?: number;
  legalActions?: CardName[];
}

// Voting result for a single action
export interface VotingResult {
  action: Action;
  votes: number;
  voters: PlayerId[];
  valid: boolean;
  reasonings?: Array<{ provider: ModelProvider; reasoning?: string }>;
}

// Top result with additional metadata
export interface TopVotingResult extends VotingResult {
  totalVotes: number;
  completed: number;
  percentage: string;
  earlyConsensus: boolean;
}

// Consensus voting data structure
export interface ConsensusVotingData {
  topResult: TopVotingResult;
  allResults: VotingResult[];
  votingDuration: number;
  currentPhase: Phase;
  gameState: GameStateSnapshot;
}

// Timing data for model performance
export interface TimingData {
  timings: Array<{ provider: ModelProvider; duration: number }>;
  parallelDuration: number;
}

export interface LLMLogEntry {
  id: string;
  timestamp: number;
  type:
    | "ai-turn-start"
    | "ai-turn-end"
    | "llm-call-start"
    | "llm-call-end"
    | "state-change"
    | "error"
    | "warning"
    | "consensus-start"
    | "consensus-compare"
    | "consensus-validation"
    | "consensus-agree"
    | "consensus-success"
    | "consensus-step"
    | "consensus-step-error"
    | "consensus-voting"
    | "consensus-complete"
    | "consensus-skipped"
    | "consensus-model-pending"
    | "consensus-model-complete"
    | "consensus-model-aborted"
    | "ai-decision-resolving"
    | "ai-decision-continuing"
    | "ai-decision-resolved";
  message: string;
  data?: Record<string, unknown>;
  children?: LLMLogEntry[];
}

export interface ConsensusDecision {
  id: string;
  votingEntry: LLMLogEntry;
  timingEntry?: LLMLogEntry;
  stepNumber: number;
  modelStatuses?: Map<number, ModelStatus>;
}

export interface ModelStatus {
  provider: ModelProvider;
  index: number;
  startTime: number;
  duration?: number;
  success?: boolean;
  completed: boolean;
  aborted?: boolean;
  action?: Action;
}

export interface PendingData {
  providers: ModelProvider[];
  totalModels: number;
  phase: string;
  gameState?: GameStateSnapshot;
}

export interface Turn {
  turnNumber: number;
  gameTurn?: number;
  decisions: ConsensusDecision[];
  pending?: boolean;
  pendingData?: PendingData;
  modelStatuses?: Map<number, ModelStatus>;
  consensusStartTime?: number;
  isSubPhase?: boolean;
  subPhaseLabel?: string;
}
