/**
 * LLMLogsContext - Separate context for LLM log display
 */
import { createContext } from "preact";
import type { LLMLogEntry } from "../components/LLMLog";

export const LLMLogsContext = createContext<LLMLogEntry[]>([]);
