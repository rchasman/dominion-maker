/**
 * The game-agnostic half of a board game's room session: a generic room
 * table whose verbs become one command each under this client's own id. A
 * board game resigns with a command of its own, so the engine records it.
 */

import type { GameShape } from "../core/game-definition";
import type { GameModule } from "../core/game-module";
import { multiplayerLogger } from "../lib/logger";
import type { CommandFor } from "./create-local-turn-session";
import { createRoomTable, type RoomTableOptions } from "./create-room-table";
import type { RoomTable } from "./table-session";

type RoomTurnSession<G extends GameShape> = RoomTable<G> & {
  /** Send a command under this client's id; a spectator's is refused and logged */
  readonly act: (build: CommandFor<G>) => void;
};

export function createRoomTurnSession<G extends GameShape>(
  module: GameModule<G>,
  { resign, ...options }: RoomTableOptions & { resign: CommandFor<G> },
): RoomTurnSession<G> {
  const { act: send, subscribe, ...room } = createRoomTable<G>(module, options);
  void subscribe;

  const act = (build: CommandFor<G>) => {
    const result = send(build);
    if (!result.ok) multiplayerLogger.warn(result.error);
  };

  return { ...room, act, resign: () => act(resign) };
}
