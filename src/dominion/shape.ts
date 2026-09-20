import type { CardName, GameState, PlayerId } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { GameCommand } from "../commands/types";
import type { Action } from "../types/action";

/** What a new Dominion game can be set up with */
export type DominionOptions = {
  kingdomCards?: CardName[] | undefined;
  seed?: number | undefined;
};

/** Dominion's types as the generic core sees them */
export type DominionShape = {
  state: GameState;
  event: GameEvent;
  command: GameCommand;
  move: Action;
  options: DominionOptions;
  playerId: PlayerId;
};
