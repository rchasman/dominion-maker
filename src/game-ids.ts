import { z } from "zod";

/**
 * Every game the app can run, listed once. This module imports no game, so
 * anything that only needs to name a game can depend on it without pulling a
 * registry, an engine or a schema table in behind it.
 */
export const GAME_IDS = {
  dominion: "dominion",
  chess: "chess",
  go: "go",
} as const;

export type GameId = keyof typeof GAME_IDS;

export const gameIdSchema = z.enum(GAME_IDS);
