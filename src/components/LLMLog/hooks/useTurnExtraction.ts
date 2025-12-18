import { useMemo } from "preact/hooks";
import type { Action } from "../../../types/action";
import type { LLMLogEntry, Turn, PendingData } from "../types";

const LOOKBACK_RANGE = 5;

function extractCardName(prompt: string): string | null {
  const cardMatch = prompt.match(/^(\w+)(?:\s+attack)?:/i);
  return cardMatch ? cardMatch[1] : null;
}

function createSubPhaseLabel(decisionType: unknown, prompt: string): string {
  const cardName = extractCardName(prompt);
  const typeStr = typeof decisionType === "string" ? decisionType : "decision";
  return cardName ? `Response to ${cardName}` : `AI ${typeStr}`;
}

function findTimingEntry(
  entries: LLMLogEntry[],
  currentIndex: number,
): LLMLogEntry | undefined {
  const startIndex = Math.max(0, currentIndex - LOOKBACK_RANGE);
  return entries
    .slice(startIndex, currentIndex)
    .reverse()
    .find(e => e.type === "consensus-compare");
}

interface TurnBuildState {
  turns: Turn[];
  buildingTurn: Turn | null;
  stepNumber: number;
}

/**
 * Hook to extract and build turns from log entries
 * Returns an array of Turn objects representing consensus decisions
 */
export const useTurnExtraction = (entries: LLMLogEntry[]): Turn[] => {
  return useMemo(() => {
    const state: TurnBuildState = {
      turns: [],
      buildingTurn: null,
      stepNumber: 0,
    };

    entries.map((entry, i) => processEntry(entry, i, entries, state));

    // Add the last turn if it has decisions OR is pending
    if (
      state.buildingTurn &&
      (state.buildingTurn.decisions.length > 0 || state.buildingTurn.pending)
    ) {
      state.turns = [...state.turns, state.buildingTurn];
    }

    return state.turns;
  }, [entries]);
};

function handleAITurnStart(entry: LLMLogEntry, state: TurnBuildState): void {
  if (state.buildingTurn && state.buildingTurn.decisions.length > 0) {
    state.turns = [...state.turns, state.buildingTurn];
  }
  const gameTurn = entry.data?.turn as number | undefined;
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
  const prompt = (entry.data?.prompt as string) || "";
  const gameTurn = entry.data?.turn as number | undefined;
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
    const gameTurn = entry.data?.turn as number | undefined;
    const pendingData = entry.data as PendingData | undefined;
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
    const pendingData = entry.data as PendingData | undefined;
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
  const provider = data.provider as string;
  const modelIndex = data.index as number;
  const startTime = data.startTime as number;
  const format = data.format as "json" | "toon" | undefined;
  if (modelIndex !== undefined) {
    state.buildingTurn.modelStatuses?.set(modelIndex, {
      provider,
      index: modelIndex,
      startTime,
      completed: false,
      format,
    });
  }
}

function handleConsensusModelComplete(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;
  const data = entry.data || {};
  const modelIndex = data.index as number | undefined;
  if (modelIndex === undefined) return;

  const status = state.buildingTurn.modelStatuses?.get(modelIndex);
  if (!status) return;

  status.duration = data.duration as number | undefined;
  status.success = data.success as boolean | undefined;
  status.completed = true;
  status.action = data.action as Action | undefined;
  status.aborted = data.aborted as boolean | undefined;
  status.format = data.format as "json" | "toon" | undefined;
}

function handleConsensusModelAborted(
  entry: LLMLogEntry,
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;
  const data = entry.data || {};
  const modelIndex = data.index as number | undefined;
  if (modelIndex === undefined) return;

  const status = state.buildingTurn.modelStatuses?.get(modelIndex);
  if (!status) return;

  status.duration = data.duration as number | undefined;
  status.completed = true;
  status.aborted = true;
}

function handleConsensusVoting(
  entry: LLMLogEntry,
  index: number,
  entries: LLMLogEntry[],
  state: TurnBuildState,
): void {
  if (!state.buildingTurn) return;

  state.stepNumber++;
  state.buildingTurn.pending = false;

  const timingEntry = findTimingEntry(entries, index);
  const modelStatusesSnapshot = state.buildingTurn.modelStatuses
    ? new Map(state.buildingTurn.modelStatuses)
    : undefined;

  state.buildingTurn.decisions = [
    ...state.buildingTurn.decisions,
    {
      id: entry.id,
      votingEntry: entry,
      ...(timingEntry !== undefined && { timingEntry }),
      stepNumber: state.stepNumber,
      ...(modelStatusesSnapshot !== undefined && { modelStatuses: modelStatusesSnapshot }),
    },
  ];
}

function processEntry(
  entry: LLMLogEntry,
  index: number,
  entries: LLMLogEntry[],
  state: TurnBuildState,
): void {
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
    handleConsensusVoting(entry, index, entries, state);
  }
}
