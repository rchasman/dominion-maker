/** Go as the shared board-game screens see it */
import type { BoardGameSpec } from "../components/Board/board-game-spec";
import { GoBoard } from "./GoBoard";
import type { GoSession } from "./go-session";
import { GO_LOG_READING } from "./devtools";
import { goModule } from "./module";
import { GO_SEAT_PRESETS } from "./presets";
import { GO_PLAYERS } from "./seat";
import type { GoShape } from "./shape";
import { GoLogRows, SIDE_TEXT_COLORS } from "./sidebar";
import { goStorage } from "./storage";

export const goBoardGame: BoardGameSpec<GoShape, GoSession> = {
  module: goModule,
  board: ({ session, ...board }) => (
    <GoBoard {...board} onPlace={session.place} onPass={session.pass} />
  ),
  log: ({ state }) => <GoLogRows size={state.size} moves={state.moves} />,
  logEntryCount: state => state.moves.length,
  colours: SIDE_TEXT_COLORS,
  players: GO_PLAYERS,
  presets: GO_SEAT_PRESETS,
  logReading: GO_LOG_READING,
  storage: goStorage,
};
