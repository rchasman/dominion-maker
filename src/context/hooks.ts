import { useContext } from "preact/hooks";
import { LLMLogsContext } from "./GameContextTypes";

export function useLLMLogs() {
  const context = useContext(LLMLogsContext);
  // Return empty logs for multiplayer mode (no GameProvider)
  return { llmLogs: context || [] };
}
