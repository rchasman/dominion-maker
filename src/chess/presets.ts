import { DEFAULT_LLM_SEAT } from "../core/seats";
import { twoColourPresets } from "../core/seat-presets";

/** The same three presets Dominion offers; White is always the seat a human takes */
export const CHESS_SEAT_PRESETS = twoColourPresets("White", DEFAULT_LLM_SEAT);
