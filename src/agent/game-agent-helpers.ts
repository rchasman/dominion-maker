/**
 * Helper functions for game agent operations
 */

import type { PlayerId } from "../types/game-state";
import type { Action } from "../types/action";
import type { DominionEngine } from "../engine";
import type { CommandResult } from "../commands/types";
import { moveToCommand } from "../dominion/move-to-command";

/** Dispatch the command a legal move maps to */
export function executeActionWithEngine(
  engine: DominionEngine,
  action: Action,
  playerId: PlayerId,
): CommandResult {
  return engine.dispatch(
    moveToCommand(engine.state, action, playerId),
    playerId,
  );
}
