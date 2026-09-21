import { createGameStorage } from "../session/game-storage";
import { loadGoEngine } from "./engine";
import { goEventSchema } from "./schemas";

/** Go keeps its own table: Dominion's and chess's seats name their own players */
export const goStorage = createGameStorage({
  label: "go",
  eventsKey: "dominion-maker-go-events",
  seatsKey: "dominion-maker-go-seats",
  eventSchema: goEventSchema,
  loadEngine: loadGoEngine,
});
