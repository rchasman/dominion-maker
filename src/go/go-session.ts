/**
 * What the Go board asks of its session, on a local table or in a room.
 * The shared table shapes carry the position; these add Go's verbs.
 */

import type { CommandFor } from "../session/create-local-turn-session";
import type { LocalTurnTable, RoomTable } from "../session/table-session";
import type { GoShape } from "./shape";

type GoTable = {
  readonly game: "go";
  readonly place: (x: number, y: number) => void;
  readonly pass: () => void;
};

export type LocalGoSession = LocalTurnTable<GoShape> & GoTable;

export type RemoteGoSession = RoomTable<GoShape> & GoTable;

export type GoSession = LocalGoSession | RemoteGoSession;

export const resignGo: CommandFor<GoShape> = playerId => ({
  type: "RESIGN",
  playerId,
});

/** Go's two verbs, built on whichever table's `act` it is handed */
export const goVerbs = (
  act: (build: CommandFor<GoShape>) => void,
): GoTable => ({
  game: "go",
  place: (x, y) => act(playerId => ({ type: "PLACE", playerId, x, y })),
  pass: () => act(playerId => ({ type: "PASS", playerId })),
});
