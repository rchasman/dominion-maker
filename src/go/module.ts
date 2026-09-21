import type { GameModule } from "../core/game-module";
import { DEFAULT_LLM_SEAT } from "../core/seats";
import { goGame } from "./definition";
import { createGoGame, loadGoEngine } from "./engine";
import {
  goCommandSchema,
  goEventSchema,
  goMoveSchema,
  goOptionsSchema,
  goStateSchema,
} from "./schemas";
import type { GoShape } from "./shape";

export const goModule: GameModule<GoShape> = {
  name: "Go",
  definition: goGame,
  createEngine: (players, options) => createGoGame(players, options),
  loadEngine: events => loadGoEngine(events),
  eventSchema: goEventSchema,
  commandSchema: goCommandSchema,
  stateSchema: goStateSchema,
  moveSchema: goMoveSchema,
  optionsSchema: goOptionsSchema,
  view: state => state,
  publicEvents: events => [...events],
  // A batch that opens with the game's first event is the whole log, not an
  // append: a rewind has to reach clients as a replacement.
  needsFullResync: events => events[0]?.type === "GAME_INITIALIZED",
  defaultLlmSeat: DEFAULT_LLM_SEAT,
};
