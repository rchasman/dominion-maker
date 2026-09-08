import type { GameState, LogEntry } from "../types/game-state";

export interface AnalysisVersion {
  turn: number;
  gameEventId: string;
  sourceEventId: string;
}

export function logEventIds(log: LogEntry[]): string[] {
  return log.flatMap(entry => [
    ...(entry.eventId ? [entry.eventId] : []),
    ...logEventIds(entry.children ?? []),
  ]);
}

export function analysisVersion(state: GameState): AnalysisVersion {
  const ids = logEventIds(state.log);
  return {
    turn: state.turn,
    gameEventId: ids[0] ?? "",
    sourceEventId: ids.at(-1) ?? "",
  };
}

export function isAnalysisApplicable(
  version: AnalysisVersion,
  state: GameState,
): boolean {
  const ids = logEventIds(state.log);
  return (
    !!version.gameEventId &&
    version.gameEventId === ids[0] &&
    version.turn <= state.turn &&
    ids.includes(version.sourceEventId)
  );
}
