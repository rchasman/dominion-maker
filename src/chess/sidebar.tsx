import type { Seats } from "../core/seats";
import type { SidebarPresets } from "../components/Board/GameSidebarComponents";
import type { TurnStatus } from "../components/Board/TurnStatusIndicator";
import { presetOf, type SeatPreset } from "../context/seat-presets";
import { run } from "../lib/run";
import { chessGame } from "./definition";
import { CHESS_SEAT_PRESETS, CHESS_SEAT_PRESET_NAMES } from "./presets";
import type { ChessState } from "./shape";

/** Each side keeps the colour of the squares it plays, on the board and off it */
const SIDE_COLORS = ["#e8d3ad", "#c9a875"] as const;

const movePairs = (moves: readonly string[]) =>
  Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    number: index + 1,
    white: moves[index * 2] ?? "",
    black: moves[index * 2 + 1] ?? "",
  }));

/** The move list, a numbered pair per row, the latest at the bottom */
export function ChessLogRows({ moves }: { moves: readonly string[] }) {
  return (
    <>
      {movePairs(moves).map(pair => (
        <div
          key={pair.number}
          style={{
            display: "flex",
            gap: "var(--space-2)",
            fontFamily: "monospace",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            lineHeight: 1.4,
          }}
        >
          <span style={{ opacity: 0.6, minWidth: "2rem" }}>{pair.number}.</span>
          <span style={{ minWidth: "4rem" }}>{pair.white}</span>
          <span>{pair.black}</span>
        </div>
      ))}
    </>
  );
}

/** A bot on the clock reads as thinking; the local human's own turn as theirs */
export function chessTurnStatus(
  state: ChessState,
  seats: Seats,
  localPlayerId: string | null,
): TurnStatus {
  const mover = chessGame.whoMustAct(state);
  return run(() => {
    if (mover === null) return null;
    if (mover === localPlayerId) return "yours";
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
    names: CHESS_SEAT_PRESET_NAMES,
    label: (preset: SeatPreset) => CHESS_SEAT_PRESETS[preset].name,
    active: presetOf(seats),
    ...(onChange !== undefined && { onChange }),
  };
}
