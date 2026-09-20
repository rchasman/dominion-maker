import { z } from "zod";
import { dominionModule } from "./dominion/module";

/** The one file that knows every game; everything else takes a GameModule */
export const GAMES = { dominion: dominionModule } as const;

export type GameId = keyof typeof GAMES;

export const gameIdSchema = z.enum(["dominion"]);

export const moduleFor = <K extends GameId>(id: K): (typeof GAMES)[K] =>
  GAMES[id];
