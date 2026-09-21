import { useMemo } from "preact/hooks";
import { LocalTableView } from "../components/Board/LocalTableView";
import { openStoredTable } from "../session/game-storage";
import { goBoardGame } from "./board-game";
import { createLocalGoSession } from "./create-local-go-session";
import { createGoGame } from "./engine";
import { GO_SEAT_PRESETS } from "./presets";
import { GO_PLAYERS } from "./seat";
import { DEFAULT_GO_SIZE } from "./shape";
import { goStorage } from "./storage";

const openGoTable = () =>
  openStoredTable({
    storage: goStorage,
    presets: GO_SEAT_PRESETS,
    players: GO_PLAYERS,
    createEngine: () =>
      createGoGame([...GO_PLAYERS], { size: DEFAULT_GO_SIZE }),
  });

export function GoApp({ onBackToHome }: { onBackToHome: () => void }) {
  const session = useMemo(() => createLocalGoSession(openGoTable()), []);
  return (
    <LocalTableView
      session={session}
      spec={goBoardGame}
      onBackToHome={onBackToHome}
    />
  );
}
