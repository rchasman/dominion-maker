import { useContext } from "preact/hooks";
import { GameContext, LLMLogsContext } from "./GameContext";

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

export function useLLMLogs() {
  const context = useContext(LLMLogsContext);
  if (!context) {
    // Return empty logs for multiplayer mode (no GameProvider)
    return { llmLogs: [] };
  }
  return context;
}
