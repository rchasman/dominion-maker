/**
 * Chess's reading of its own log for the shared event devtools. The scrubber
 * stops on the moves and on a resignation, which are the acts a player takes;
 * the opening event is setup and carries no position of its own.
 */
import type { EventDevtoolsAdapter } from "../components/EventDevtools/adapter";
import { loadChessEngine } from "./engine";
import type { ChessEvent } from "./shape";

const MOVES = "moves";
const GAME = "game";

const CHESS_EVENT_CATEGORIES = [MOVES, GAME] as const;

const MOVE_COLOUR = "#8b5cf6";
const SETUP_COLOUR = "#22c55e";
const RESIGN_COLOUR = "#dc2626";

const PLIES_PER_MOVE = 2;

/** "12. e4" for White, "12... e5" for Black, as a scoresheet reads */
const moveLabel = (ply: number, san: string): string => {
  const number = Math.floor(ply / PLIES_PER_MOVE) + 1;
  return ply % PLIES_PER_MOVE === 0
    ? `${number}. ${san}`
    : `${number}... ${san}`;
};

export function chessEventLabels(
  events: readonly ChessEvent[],
): Map<ChessEvent, string> {
  return events.reduce(
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
}

/** The position after the first `index + 1` events, replayed here */
export const chessStateAt =
  (events: readonly ChessEvent[]) =>
  (index: number): unknown =>
    loadChessEngine(events.slice(0, index + 1)).state;

export function chessDevtoolsAdapter(
  events: readonly ChessEvent[],
  stateAt: (index: number) => unknown,
): EventDevtoolsAdapter<ChessEvent> {
  const labels = chessEventLabels(events);
  return {
    isRoot: event => event.type === "MOVE" || event.type === "RESIGNED",
    label: event => labels.get(event) ?? event.type,
    category: event => (event.type === "MOVE" ? MOVES : GAME),
    categories: CHESS_EVENT_CATEGORIES,
    colour: event => {
      if (event.type === "MOVE") return MOVE_COLOUR;
      return event.type === "RESIGNED" ? RESIGN_COLOUR : SETUP_COLOUR;
    },
    stateAt,
  };
}
