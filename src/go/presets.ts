import { BOARD_GAME_LLM_SEAT } from "../core/seats";
import { twoColourPresets } from "../core/seat-presets";

/** The same three presets Dominion offers; Black is always the seat a human takes */
export const GO_SEAT_PRESETS = twoColourPresets("Black", BOARD_GAME_LLM_SEAT);
