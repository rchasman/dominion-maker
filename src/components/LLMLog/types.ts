import type { ModelProvider } from "../../config/models";
import type { Action } from "../../types/action";
import type {
  LLMLogEntryInput,
  WeightedVote,
} from "../../core/consensus/types";
import type { LlmSeatConfig } from "../../core/seats";

/** An LLM-controlled seat and its config, as the settings panel edits it */
export type LlmSeat = { playerId: string; config: LlmSeatConfig };
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

export type LLMLogEntry = LLMLogEntryInput & {
  id: string;
  timestamp: number;
  children?: LLMLogEntry[];
};

/** Jev's second opinion on the winner; probabilities, not verdicts */
export interface ConsensusVerdict {
  blunder: number;
  followsOverride?: number;
}

export interface ConsensusDecision {
  id: string;
  votingEntry: LLMLogEntry;
  timingEntry?: LLMLogEntry;
  stepNumber: number;
  modelStatuses?: Map<number, ModelStatus>;
  actionId?: string;
  verdict?: ConsensusVerdict;
}

export interface ModelStatus {
  provider: ModelProvider;
  index: number;
  startTime: number;
  duration?: number | undefined;
  success?: boolean | undefined;
  completed: boolean;
  aborted?: boolean | undefined;
  action?: Action | undefined;
  distribution?: WeightedVote<Action>[] | undefined;
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
