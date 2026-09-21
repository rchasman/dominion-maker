/** Chess's reading of its own log for the shared event devtools */
import type { TurnLogReading } from "../components/EventDevtools/turn-log-adapter";
import type { ChessEvent } from "./shape";

const PLIES_PER_MOVE = 2;

/** "12. e4" for White, "12... e5" for Black, as a scoresheet reads */
const moveLabel = (ply: number, san: string): string => {
  const number = Math.floor(ply / PLIES_PER_MOVE) + 1;
  return ply % PLIES_PER_MOVE === 0
    ? `${number}. ${san}`
    : `${number}... ${san}`;
};

const chessEventLabels = (
  events: readonly ChessEvent[],
): Map<ChessEvent, string> =>
  events.reduce(
    (built, event) => {
      if (event.type === "MOVE") {
        built.labels.set(event, moveLabel(built.plies, event.san));
        return { labels: built.labels, plies: built.plies + 1 };
      }
      const label =
        event.type === "RESIGNED"
          ? `${event.playerId} resigned`
          : `${event.players[0]} vs ${event.players[1]}`;
      built.labels.set(event, label);
      return built;
    },
    { labels: new Map<ChessEvent, string>(), plies: 0 },
  ).labels;

export const CHESS_LOG_READING: TurnLogReading<ChessEvent> = {
  isPlay: event => event.type === "MOVE",
  isResign: event => event.type === "RESIGNED",
  labels: chessEventLabels,
};
