import type { LlmSeatConfig } from "../core/seats";
import { DEFAULT_LLM_SEAT } from "../core/seats";

/**
 * The LLM roster a new chess seat starts with. It lives apart from the module
 * so the start screen can name the presets without loading a chess engine.
 * Jev judges a Dominion state it was taught; it has no chess opinion.
 */
export const CHESS_LLM_SEAT: LlmSeatConfig = {
  ...DEFAULT_LLM_SEAT,
  models: DEFAULT_LLM_SEAT.models.filter(model => model !== "jev"),
  consensusCount: 6,
};
