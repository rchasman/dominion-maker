/**
 * BoardWithProviders - Reusable wrapper for Board with LLMLogsContext
 *
 * Game state is read from signals directly; no GameContext needed.
 * LLMLogsContext is still provided for the sidebar component.
 * AnimationProvider must be provided by the parent (SinglePlayerApp or GameRoom).
 */
import type { ComponentChildren } from "preact";
import { LLMLogsContext } from "../../context/GameContextTypes";
import type { LLMLogEntry } from "../LLMLog";

interface BoardWithProvidersProps {
  llmLogs: LLMLogEntry[];
  children: ComponentChildren;
}

export function BoardWithProviders({
  llmLogs,
  children,
}: BoardWithProvidersProps) {
  return (
    <LLMLogsContext.Provider value={llmLogs}>
      {children}
    </LLMLogsContext.Provider>
  );
}
