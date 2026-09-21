import { createRoomTurnSession } from "../session/create-room-turn-session";
import type { RoomTableOptions } from "../session/create-room-table";
import { goVerbs, resignGo, type RemoteGoSession } from "./go-session";
import { goModule } from "./module";
import type { GoShape } from "./shape";

export function createRemoteGoSession(
  options: Omit<RoomTableOptions, "game">,
): RemoteGoSession {
  const { act, ...room } = createRoomTurnSession<GoShape>(goModule, {
    ...options,
    game: "go",
    resign: resignGo,
  });
  return { ...room, ...goVerbs(act) };
}
