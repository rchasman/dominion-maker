/**
 * BoardWithProviders - Reusable wrapper for Board with all required providers
 *
 * Provides AnimationProvider, GameContext, and LLMLogsContext.
 * Used by both single-player (via GameProvider) and multiplayer (via GameRoom).
 */
import type { ComponentChildren } from "preact";
import type { GameContextValue } from "../../context/GameContextTypes";
import { GameContext, LLMLogsContext } from "../../context/GameContextTypes";
import { AnimationProvider } from "../../animation";
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
    <AnimationProvider>
      <GameContext.Provider value={gameContext}>
        <LLMLogsContext.Provider value={{ llmLogs }}>
          {children}
        </LLMLogsContext.Provider>
      </GameContext.Provider>
    </AnimationProvider>
  );
}
