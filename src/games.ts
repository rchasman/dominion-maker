import type { GameShape } from "./core/game-definition";
import type { GameModule } from "./core/game-module";
import type { GameId } from "./game-ids";
import { chessModule } from "./chess/module";
import { dominionModule } from "./dominion/module";

/**
 * The one file that knows every game; everything else takes a GameModule.
 * The `satisfies` makes a registry entry without an id, or an id without an
 * entry, a compile error.
 */
export const GAMES = {
  dominion: dominionModule,
  chess: chessModule,
} as const satisfies Record<GameId, GameModule<GameShape>>;

export const moduleFor = <K extends GameId>(id: K): (typeof GAMES)[K] =>
  GAMES[id];
