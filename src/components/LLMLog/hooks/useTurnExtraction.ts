import { useMemo } from "preact/hooks";
import {
  readBoolean,
  readMove,
  readNumber,
  readPending,
  readProvider,
  readString,
  readUsage,
  readVotes,
} from "../utils/entryData";
import type { LLMLogEntry, Turn } from "../types";

function extractCardName(prompt: string): string | null {
  const cardMatch = prompt.match(/^(\w+)(?:\s+attack)?:/i);
  return cardMatch?.[1] ?? null;
}

function createSubPhaseLabel(decisionType: unknown, prompt: string): string {
  const cardName = extractCardName(prompt);
  const typeStr = typeof decisionType === "string" ? decisionType : "decision";
  return cardName ? `Response to ${cardName}` : `AI ${typeStr}`;
}

interface TurnBuildState {
  turns: Turn[];
  buildingTurn: Turn | null;
  stepNumber: number;
}

/**
 * Build turns from log entries.
 * Returns an array of Turn objects representing consensus decisions
 */
export function extractTurns(entries: LLMLogEntry[]): Turn[] {
  const state: TurnBuildState = {
    turns: [],
    buildingTurn: null,
    stepNumber: 0,
  };

  entries.map(entry => processEntry(entry, state));

  // Add the last turn if it has decisions OR is pending
  if (
    state.buildingTurn &&
    (state.buildingTurn.decisions.length > 0 || state.buildingTurn.pending)
  ) {
    state.turns = [...state.turns, state.buildingTurn];
  }

  return state.turns;
}

/** True while a consensus has started and neither a winner nor an error closed it */
export const hasLiveConsensus = (turns: Turn[]): boolean =>
  turns.some(turn => turn.pending === true);

export const useTurnExtraction = (entries: LLMLogEntry[]): Turn[] =>
  useMemo(() => extractTurns(entries), [entries]);

function handleAITurnStart(entry: LLMLogEntry, state: TurnBuildState): void {
  if (state.buildingTurn && state.buildingTurn.decisions.length > 0) {
    state.turns = [...state.turns, state.buildingTurn];
  }
  const gameTurn = readNumber(entry.data?.["turn"]);
  state.buildingTurn = {
    turnNumber: state.turns.length + 1,
    ...(gameTurn !== undefined && { gameTurn }),
    decisions: [],
  };
  state.stepNumber = 0;
}

function handleAIDecisionResolving(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (state.buildingTurn && state.buildingTurn.decisions.length > 0) {
    state.turns = [...state.turns, state.buildingTurn];
  }
  const prompt = readString(entry.data?.["prompt"]) ?? "";
  const gameTurn = readNumber(entry.data?.["turn"]);
  state.buildingTurn = {
    turnNumber: state.turns.length + 1,
    ...(gameTurn !== undefined && { gameTurn }),
    decisions: [],
    isSubPhase: true,
    subPhaseLabel: createSubPhaseLabel(entry.data?.decisionType, prompt),
  };
  state.stepNumber = 0;
}

function handleConsensusStart(entry: LLMLogEntry, state: TurnBuildState): void {
  if (!state.buildingTurn) {
    const gameTurn = readNumber(entry.data?.["turn"]);
    const pendingData = readPending(entry.data);
    state.buildingTurn = {
      turnNumber: state.turns.length + 1,
      ...(gameTurn !== undefined && { gameTurn }),
      decisions: [],
      pending: true,
      ...(pendingData !== undefined && { pendingData }),
      modelStatuses: new Map(),
      consensusStartTime: entry.timestamp,
    };
  } else {
    state.buildingTurn.pending = true;
    const pendingData = readPending(entry.data);
    if (pendingData !== undefined) {
      state.buildingTurn.pendingData = pendingData;
    }
    state.buildingTurn.modelStatuses = new Map();
    state.buildingTurn.consensusStartTime = entry.timestamp;
  }
}

function handleConsensusModelPending(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;
  const data = entry.data || {};
  const provider = readProvider(data["provider"]);
  const modelIndex = readNumber(data["index"]);
  if (provider !== undefined && modelIndex !== undefined) {
    state.buildingTurn.modelStatuses?.set(modelIndex, {
      provider,
      index: modelIndex,
      startTime: readNumber(data["startTime"]) ?? 0,
      completed: false,
    });
  }
}

function handleConsensusModelComplete(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;
  const data = entry.data || {};
  const modelIndex = readNumber(data["index"]);
  if (modelIndex === undefined) return;

  const status = state.buildingTurn.modelStatuses?.get(modelIndex);
  if (!status) return;

  status.duration = readNumber(data["duration"]);
  status.success = readBoolean(data["success"]);
  status.completed = true;
  status.action = readMove(data["action"]);
  status.key = readString(data["key"]);
  status.label = readString(data["label"]);
  status.distribution = readVotes(data["distribution"]);
  status.aborted = readBoolean(data["aborted"]);
  status.usage = readUsage(data["usage"]);
}

function handleConsensusModelAborted(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;
  const data = entry.data || {};
  const modelIndex = readNumber(data["index"]);
  if (modelIndex === undefined) return;

  const status = state.buildingTurn.modelStatuses?.get(modelIndex);
  if (!status) return;

  status.duration = readNumber(data["duration"]);
  status.completed = true;
  status.aborted = true;
}

function handleConsensusStepError(state: TurnBuildState): void {
  if (!state.buildingTurn) return;
  state.buildingTurn.pending = false;
}

function handleConsensusVoting(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;

  state.stepNumber++;
  state.buildingTurn.pending = false;

  const modelStatusesSnapshot = state.buildingTurn.modelStatuses
    ? new Map(state.buildingTurn.modelStatuses)
    : undefined;

  const actionId = entry.data?.actionId;
  state.buildingTurn.decisions = [
    ...state.buildingTurn.decisions,
    {
      id: entry.id,
      votingEntry: entry,
      ...(typeof actionId === "string" && { actionId }),
      stepNumber: state.stepNumber,
      ...(modelStatusesSnapshot !== undefined && {
        modelStatuses: modelStatusesSnapshot,
      }),
    },
  ];
}

// The verdict arrives after the vote, often after the next decision has
// started, so it is matched to its decision by actionId across all turns
function handleConsensusVerdict(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  const data = entry.data || {};
  const actionId = data.actionId;
  const blunder = data.blunder;
  if (typeof actionId !== "string" || typeof blunder !== "number") return;
  const followsOverride = data.followsOverride;
  const verdict = {
    blunder,
    ...(typeof followsOverride === "number" && { followsOverride }),
  };
  const turns = state.buildingTurn
    ? [...state.turns, state.buildingTurn]
    : state.turns;
  const decision = turns
    .flatMap(turn => turn.decisions)
    .find(d => d.actionId === actionId);
  if (decision) decision.verdict = verdict;
}

function processEntry(entry: LLMLogEntry, state: TurnBuildState): void {
  if (entry.type === "ai-turn-start") {
    handleAITurnStart(entry, state);
  } else if (entry.type === "ai-decision-resolving") {
    handleAIDecisionResolving(entry, state);
  } else if (entry.type === "consensus-start") {
    handleConsensusStart(entry, state);
  } else if (entry.type === "consensus-model-pending") {
    handleConsensusModelPending(entry, state);
  } else if (entry.type === "consensus-model-complete") {
    handleConsensusModelComplete(entry, state);
  } else if (entry.type === "consensus-model-aborted") {
    handleConsensusModelAborted(entry, state);
  } else if (entry.type === "consensus-voting") {
    handleConsensusVoting(entry, state);
  } else if (entry.type === "consensus-step-error") {
    handleConsensusStepError(state);
  } else if (entry.type === "consensus-verdict") {
    handleConsensusVerdict(entry, state);
  }
}
