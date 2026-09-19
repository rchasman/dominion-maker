import type { GameState, PlayerId } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { GameCommand } from "../commands/types";
import type { Action } from "../types/action";

/** Dominion's types as the generic core sees them */
export type DominionShape = {
  state: GameState;
  event: GameEvent;
  command: GameCommand;
  move: Action;
  playerId: PlayerId;
};
