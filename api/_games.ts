import { dominionGame } from "../src/dominion/definition";
import { gameStateSchema } from "../src/validation/game-state";

/** Every game the endpoints can drive; the request's `game` field picks one */
export const GAMES = {
  dominion: { game: dominionGame, stateSchema: gameStateSchema },
} as const;

export type GameId = keyof typeof GAMES;
