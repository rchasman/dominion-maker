import type { GameState } from "../types/game-state";
import { applyEvents } from "../events/apply";
import { runExecution, type ExecutionResponse } from "./execute";
import { migrateExecution } from "./migrate-execution";
import { validateCheckpoint } from "./validate-checkpoint";

/** Compatibility ends here: the runner only accepts current execution frames. */
export function resumeExecution(
  state: GameState,
  response: ExecutionResponse,
  random: () => number = Math.random,
) {
  const migrated = migrateExecution(state, response, random);
  validateCheckpoint(state, migrated.stack, migrated.response);
  return [
    ...migrated.events,
    ...runExecution(
      applyEvents(state, migrated.events),
      migrated.stack,
      random,
      migrated.response,
    ),
  ];
}
