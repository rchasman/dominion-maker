import { recordLabel, replayMoves } from "./rules";
import type { GoMoveRecord } from "./shape";

/** Each side keeps the colour of its stones on the board */
export const STONE_COLORS = ["#1c1c1c", "#f2f2f2"] as const;

/** Black's stone colour vanishes on the dark sidebar, so its text is a grey */
export const SIDE_TEXT_COLORS = ["#a3a3a3", "#f2f2f2"] as const;

const CAPTURE_COLOR = "#ef4444";

type LogRow = {
  index: number;
  side: "b" | "w";
  label: string;
  captured: number;
};

/** A log no engine produced still lists its points, with no captures to report */
const capturesOf = (size: number, moves: readonly GoMoveRecord[]): number[] => {
  try {
    return replayMoves(size, moves).capturedPerMove;
  } catch {
    return moves.map(() => 0);
  }
};

const logRows = (size: number, moves: readonly GoMoveRecord[]): LogRow[] => {
  const captures = capturesOf(size, moves);
  return moves.map((move, index) => ({
    index,
    side: index % 2 === 0 ? "b" : "w",
    label: recordLabel(size, move),
    captured: captures[index] ?? 0,
  }));
};

const captureText = (captured: number): string =>
  captured === 1 ? "Captures 1 stone" : `Captures ${captured} stones`;

/** One row per move, its capture nested beneath it the way Dominion nests a play */
export function GoLogRows({
  size,
  moves,
}: {
  size: number;
  moves: readonly GoMoveRecord[];
}) {
  return (
    <>
      {logRows(size, moves).map(row => (
        <div
          key={row.index}
          data-go-move={row.index}
          style={{
            fontFamily: "monospace",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            lineHeight: 1.4,
            whiteSpace: "pre",
          }}
        >
          <div>
            <span style={{ opacity: 0.6 }}>{row.index + 1}. </span>
            <span
              data-go-side={row.side}
              style={{
                color: SIDE_TEXT_COLORS[row.side === "b" ? 0 : 1],
                fontWeight: 600,
              }}
            >
              {row.label}
            </span>
          </div>
          {row.captured > 0 && (
            <div data-go-event="capture">
              <span
                style={{ color: "var(--color-border)", userSelect: "none" }}
              >
                └─{" "}
              </span>
              <span style={{ color: CAPTURE_COLOR, fontWeight: 600 }}>
                {captureText(row.captured)}
              </span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
