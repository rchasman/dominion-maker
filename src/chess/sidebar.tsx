import type { Seats } from "../core/seats";
import type { SidebarPresets } from "../components/Board/GameSidebarComponents";
import type { TurnStatus } from "../components/Board/TurnStatusIndicator";
import {
  SEAT_PRESET_NAMES,
  presetOf,
  type SeatPreset,
} from "../core/seat-presets";
import { run } from "../lib/run";
import { chessGame } from "./definition";
import { describeMove, eventText, type ChessMoveEvent } from "./describe-move";
import { CHESS_SEAT_PRESETS } from "./presets";
import { replayMoves } from "./replay";
import type { ChessState } from "./shape";

/** Each side keeps the colour of the squares it plays, on the board and off it */
const SIDE_COLORS = ["#e8d3ad", "#c9a875"] as const;

const EVENT_COLORS: Record<ChessMoveEvent["kind"], string> = {
  capture: "#ef4444",
  "en-passant": "#a855f7",
  castle: "#3b82f6",
  promotion: "#22c55e",
  check: "#f59e0b",
  checkmate: "#ef4444",
};

type LogRow = {
  ply: number;
  side: "w" | "b";
  san: string;
  text: string;
  events: ChessMoveEvent[];
};

/** `12.` is White's twelfth move and `12…` is Black's reply, as in print */
const moveLabel = (ply: number): string =>
  `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"}`;

/** A log no engine produced still lists its SAN, with nothing to say about it */
const logRows = (moves: readonly string[]): LogRow[] => {
  const replayed = replayMoves(moves);
  return moves.map((san, ply) => {
    const move = replayed?.[ply];
    const side = ply % 2 === 0 ? "w" : "b";
    if (move === undefined) return { ply, side, san, text: san, events: [] };
    const described = describeMove(move);
    return {
      ply,
      side,
      san,
      text: `${described.piece} to ${described.to}`,
      events: described.events,
    };
  });
};

/** One row per move, its events nested beneath it the way Dominion nests a play */
export function ChessLogRows({ moves }: { moves: readonly string[] }) {
  return (
    <>
      {logRows(moves).map(row => (
        <div
          key={row.ply}
          data-chess-ply={row.ply}
          style={{
            fontFamily: "monospace",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            lineHeight: 1.4,
            whiteSpace: "pre",
          }}
        >
          <div>
            <span style={{ opacity: 0.6 }}>{moveLabel(row.ply)} </span>
            <span
              data-chess-side={row.side}
              style={{
                color: SIDE_COLORS[row.side === "w" ? 0 : 1],
                fontWeight: 600,
              }}
            >
              {row.text}
            </span>
            {row.text !== row.san && (
              <span style={{ opacity: 0.6 }}> ({row.san})</span>
            )}
          </div>
          {row.events.map((event, index) => (
            <div key={event.kind} data-chess-event={event.kind}>
              <span
                style={{ color: "var(--color-border)", userSelect: "none" }}
              >
                {index === row.events.length - 1 ? "└─ " : "├─ "}
              </span>
              <span
                style={{
                  color: EVENT_COLORS[event.kind],
                  fontWeight: event.kind === "checkmate" ? 700 : 600,
                }}
              >
                {eventText(event)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * A bot on the clock reads as thinking; the local human's own turn as theirs.
 * A turn still being processed reads as neither, matching Dominion: the seat
 * is nominally the human's, but the table is not theirs to act on yet.
 */
export function chessTurnStatus(
  state: ChessState,
  seats: Seats,
  localPlayerId: string | null,
  isProcessing: boolean,
): TurnStatus {
  const mover = chessGame.whoMustAct(state);
  return run(() => {
    if (mover === null) return null;
    if (mover === localPlayerId) return isProcessing ? null : "yours";
    return seats[mover]?.kind === "human" ? null : "thinking";
  });
}

export function chessMoverColor(state: ChessState): string {
  const mover = chessGame.whoMustAct(state);
  const index = state.playerOrder.findIndex(id => id === mover);
  return SIDE_COLORS[index] ?? "var(--color-text-secondary)";
}

/**
 * The same three modes Dominion offers. A room leaves out `onChange`, so the
 * switcher hides itself exactly as it does on Dominion's multiplayer board.
 */
export function chessPresets(
  seats: Seats,
  onChange?: (preset: SeatPreset) => void,
): SidebarPresets {
  return {
    names: SEAT_PRESET_NAMES,
    label: (preset: SeatPreset) => CHESS_SEAT_PRESETS[preset].name,
    active: presetOf(seats),
    ...(onChange !== undefined && { onChange }),
  };
}
