import { createGameStorage } from "../session/game-storage";
import { loadChessEngine } from "./engine";
import { chessEventSchema } from "./schemas";

/** Chess keeps its own table: Dominion's seats name Dominion's players */
export const chessStorage = createGameStorage({
  label: "chess",
  eventsKey: "dominion-maker-chess-events",
  seatsKey: "dominion-maker-chess-seats",
  eventSchema: chessEventSchema,
  loadEngine: loadChessEngine,
});
