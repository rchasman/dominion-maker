export interface LLMLogEntry {
  id: string;
  timestamp: number;
  type: "ai-turn-start" | "ai-turn-end" | "llm-call-start" | "llm-call-end" | "state-change" | "error" | "warning" | "consensus-start" | "consensus-compare" | "consensus-validation" | "consensus-agree" | "consensus-success" | "consensus-step" | "consensus-voting" | "consensus-complete" | "consensus-model-pending" | "consensus-model-complete" | "consensus-model-aborted";
  message: string;
  data?: Record<string, any>;
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
  provider: string;
  index: number;
  startTime: number;
  duration?: number;
  success?: boolean;
  completed: boolean;
  aborted?: boolean;
  action?: any;
}

export interface Turn {
  turnNumber: number;
  gameTurn?: number;
  decisions: ConsensusDecision[];
  pending?: boolean;
  pendingData?: { providers: string[]; totalModels: number; phase: string };
  modelStatuses?: Map<number, ModelStatus>;
  consensusStartTime?: number;
}
