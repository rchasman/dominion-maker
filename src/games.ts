import { z } from "zod";
import { dominionModule } from "./dominion/module";

/** The one file that knows every game; everything else takes a GameModule */
export const GAMES = { dominion: dominionModule } as const;

export type GameId = keyof typeof GAMES;

/** Listed once per game; a game missing here is a compile error */
const GAME_IDS = { dominion: "dominion" } as const satisfies Record<
  GameId,
  GameId
>;

export const gameIdSchema = z.enum(GAME_IDS);

export const moduleFor = <K extends GameId>(id: K): (typeof GAMES)[K] =>
  GAMES[id];
