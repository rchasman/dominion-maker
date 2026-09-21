/** Go's reading of its own log for the shared event devtools */
import type { TurnLogReading } from "../components/EventDevtools/turn-log-adapter";
import { pointKey, pointLabel } from "./rules";
import type { GoEvent, GoPassed, GoStonePlaced } from "./shape";

const isPlay = (event: GoEvent): event is GoStonePlaced | GoPassed =>
  event.type === "STONE_PLACED" || event.type === "PASSED";

/** A row label needs the board size; a log with no setup event keeps "x,y" */
const playLabel = (
  event: GoStonePlaced | GoPassed,
  size: number | undefined,
): string => {
  if (event.type === "PASSED") return "pass";
  return size === undefined ? pointKey(event) : pointLabel(size, event);
};

/** "12. D4" for a stone and "13. pass" for a pass, as a game record reads */
const goEventLabels = (events: readonly GoEvent[]): Map<GoEvent, string> => {
  const size = events.find(event => event.type === "GAME_INITIALIZED")?.size;
  return events.reduce(
    (built, event) => {
      if (isPlay(event)) {
        built.labels.set(
          event,
          `${built.moves + 1}. ${playLabel(event, size)}`,
        );
        return { labels: built.labels, moves: built.moves + 1 };
      }
      const label =
        event.type === "RESIGNED"
          ? `${event.playerId} resigned`
          : `${event.players[0]} vs ${event.players[1]}`;
      built.labels.set(event, label);
      return built;
    },
    { labels: new Map<GoEvent, string>(), moves: 0 },
  ).labels;
};

export const GO_LOG_READING: TurnLogReading<GoEvent> = {
  isPlay,
  isResign: event => event.type === "RESIGNED",
  labels: goEventLabels,
};
