import type { GameModule } from "../core/game-module";
import { DEFAULT_LLM_SEAT } from "../core/seats";
import { chessGame } from "./definition";
import { createChessGame, loadChessEngine } from "./engine";
import {
  chessCommandSchema,
  chessEventSchema,
  chessMoveSchema,
  chessOptionsSchema,
  chessStateSchema,
} from "./schemas";
import type { ChessShape } from "./shape";

export const chessModule: GameModule<ChessShape> = {
  name: "Chess",
  definition: chessGame,
  createEngine: players => createChessGame(players),
  loadEngine: events => loadChessEngine(events),
  eventSchema: chessEventSchema,
  commandSchema: chessCommandSchema,
  stateSchema: chessStateSchema,
  moveSchema: chessMoveSchema,
  optionsSchema: chessOptionsSchema,
  view: state => state,
  publicEvents: events => [...events],
  needsFullResync: () => false,
  defaultLlmSeat: {
    ...DEFAULT_LLM_SEAT,
    // Jev judges a Dominion state it was taught; it has no chess opinion.
    models: DEFAULT_LLM_SEAT.models.filter(model => model !== "jev"),
    consensusCount: 6,
  },
};
