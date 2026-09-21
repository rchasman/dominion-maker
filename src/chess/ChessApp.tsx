import { useMemo } from "preact/hooks";
import { LocalTableView } from "../components/Board/LocalTableView";
import { openStoredTable } from "../session/game-storage";
import { chessBoardGame } from "./board-game";
import { createLocalChessSession } from "./create-local-chess-session";
import { createChessGame } from "./engine";
import { CHESS_SEAT_PRESETS } from "./presets";
import { CHESS_PLAYERS } from "./seat";
import { chessStorage } from "./storage";

const openChessTable = () =>
  openStoredTable({
    storage: chessStorage,
    presets: CHESS_SEAT_PRESETS,
    players: CHESS_PLAYERS,
    createEngine: () => createChessGame([...CHESS_PLAYERS]),
  });

export function ChessApp({ onBackToHome }: { onBackToHome: () => void }) {
  const session = useMemo(() => createLocalChessSession(openChessTable()), []);
  return (
    <LocalTableView
      session={session}
      spec={chessBoardGame}
      onBackToHome={onBackToHome}
    />
  );
}
