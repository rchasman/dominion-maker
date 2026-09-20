import type { TokenUsage } from "../../core/consensus/cost";
import type { ModelProvider } from "../../config/models";
import type { Action } from "../../types/action";
import type { LLMLogEntry, WeightedVote } from "../../core/consensus/types";
import type { LlmSeatConfig } from "../../core/seats";

export type { LLMLogEntry } from "../../core/consensus/types";

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
}

/** One share of a model's probability mass, keyed by the game's own move key */
export type LoggedVote = WeightedVote<Action> & { key?: string | undefined };

// Voting result for a single action
export interface VotingResult {
  /** The game's own key for this move; the viewer never re-derives one */
  key?: string | undefined;
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

/** Jev's second opinion on the winner; probabilities, not verdicts */
export interface ConsensusVerdict {
  blunder: number;
  followsOverride?: number;
}

export interface ConsensusDecision {
  id: string;
  votingEntry: LLMLogEntry;
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
  key?: string | undefined;
  distribution?: LoggedVote[] | undefined;
  usage?: TokenUsage | undefined;
}

export interface PendingData {
  providers: ModelProvider[];
  totalModels: number;
  phase: string;
  gameState?: GameStateSnapshot;
  /** The game's own keys for this decision's legal moves */
  legalKeys?: string[];
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
