/**
 * BoardWithProviders - Reusable wrapper for Board with all required providers
 *
 * Provides GameContext and LLMLogsContext.
 * AnimationProvider must be provided by the parent (SinglePlayerApp or GameRoom).
 */
import type { ComponentChildren } from "preact";
import type { GameContextValue } from "../../context/GameContextTypes";
import { GameContext, LLMLogsContext } from "../../context/GameContextTypes";
import type { LLMLogEntry } from "../LLMLog";

interface BoardWithProvidersProps {
  gameContext: GameContextValue;
  llmLogs: LLMLogEntry[];
  children: ComponentChildren;
}

export function BoardWithProviders({
  gameContext,
  llmLogs,
  children,
}: BoardWithProvidersProps) {
  return (
    <GameContext.Provider value={gameContext}>
      <LLMLogsContext.Provider value={{ llmLogs }}>
        {children}
      </LLMLogsContext.Provider>
    </GameContext.Provider>
  );
}
