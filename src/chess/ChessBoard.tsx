import { useMemo, useState } from "preact/hooks";
import { Chess } from "chess.js";
import type { ControllerConfig, ControllerKind, Seats } from "../core/seats";
import { HUMAN_SEAT, hasLlmSeat } from "../core/seats";
import { SeatSelector } from "../components/SeatSelector";
import type { LLMLogEntry } from "../components/LLMLog";
import { LLMLog } from "../components/LLMLog";
import { run } from "../lib/run";
import { chessGame } from "./definition";
import { chessModule } from "./module";
import type { ChessMove, ChessState } from "./shape";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const PROMOTION_ORDER = ["q", "r", "b", "n"] as const;
const DEFAULT_SEAT_OPTIONS: readonly ControllerKind[] = [
  "human",
  "heuristic",
  "llm",
];

const GLYPHS: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

const PROMOTION_NAMES: Record<string, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

const LIGHT_SQUARE = "#e8d3ad";
const DARK_SQUARE = "#9c7a52";
const SELECTED_TINT = "rgba(250, 204, 21, 0.55)";
const LAST_MOVE_TINT = "rgba(250, 204, 21, 0.28)";
const CHECK_TINT = "rgba(220, 38, 38, 0.6)";

type Piece = { square: string; type: string; color: string };

type Pending = { from: string; to: string; options: ChessMove[] };

export interface ChessBoardProps {
  state: ChessState;
  seats: Seats;
  entries: LLMLogEntry[];
  /** The seat this client plays; the board flips when it is Black */
  localPlayerId: string | null;
  onMove: (san: string) => void;
  /** Omitted where the table is not this client's to change */
  onSeatChange?: (player: string, config: ControllerConfig) => void;
  seatOptions?: readonly ControllerKind[];
  onNewGame?: () => void;
  onTakeBack?: () => void;
  onResign?: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

const isLightSquare = (fileIndex: number, rank: string): boolean =>
  (fileIndex + Number(rank)) % 2 === 0;

const piecesOf = (
  board: readonly (readonly (Piece | null)[])[],
): Map<string, Piece> =>
  new Map<string, Piece>(
    board.flatMap(row =>
      row.flatMap(piece => (piece === null ? [] : [[piece.square, piece]])),
    ),
  );

const movePairs = (moves: readonly string[]) =>
  Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    number: index + 1,
    white: moves[index * 2] ?? "",
    black: moves[index * 2 + 1] ?? "",
  }));

const resultText = (state: ChessState): string | null => {
  if (!state.gameOver) return null;
  const winner = state.winnerId;
  if (state.result === "stalemate") return "Draw by stalemate";
  if (state.result === "draw") return "Draw";
  if (state.result === "checkmate") return `Checkmate. ${winner} wins.`;
  if (state.result === "resignation") return `Resignation. ${winner} wins.`;
  return "Game over";
};

/**
 * The whole chess surface: an 8x8 SVG board plus the sidebar. Everything it
 * shows arrives as a prop, so a room renders the same board from its own
 * state and simply leaves out the buttons a room has no business offering.
 */
export function ChessBoard({
  state,
  seats,
  entries,
  localPlayerId,
  onMove,
  onSeatChange,
  seatOptions = DEFAULT_SEAT_OPTIONS,
  onNewGame,
  onTakeBack,
  onResign,
  onBack,
  disabled = false,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const replay = useMemo(() => {
    const chess = new Chess();
    for (const san of state.moves) chess.move(san);
    return chess;
  }, [state]);

  const mover = chessGame.whoMustAct(state);
  const legalMoves = useMemo(
    () => (mover === null ? [] : chessGame.legalMoves(state, mover)),
    [state, mover],
  );
  const pieces = piecesOf(replay.board());
  const lastMove = replay.history({ verbose: true }).at(-1) ?? null;
  const checkedKing = run(() => {
    if (!state.inCheck) return null;
    const side = replay.turn();
    const entry = [...pieces.entries()].find(
      ([, piece]) => piece.type === "k" && piece.color === side,
    );
    return entry?.[0] ?? null;
  });

  const flipped = localPlayerId === state.playerOrder[1];
  const orderedFiles = flipped ? [...FILES].reverse() : [...FILES];
  const orderedRanks = flipped ? [...RANKS].reverse() : [...RANKS];

  const myMove = mover === localPlayerId;
  const interactive = myMove && !disabled;
  const targets = legalMoves.filter(move => move.from === selected);

  const selectFrom = (square: string) =>
    setSelected(legalMoves.some(move => move.from === square) ? square : null);

  const handleSquare = (square: string) => {
    if (!interactive || pending !== null) return;
    if (selected === null) {
      selectFrom(square);
      return;
    }
    const matches = legalMoves.filter(
      move => move.from === selected && move.to === square,
    );
    if (matches.length === 0) {
      selectFrom(square);
      return;
    }
    if (matches.length === 1 && matches[0] !== undefined) {
      setSelected(null);
      onMove(matches[0].san);
      return;
    }
    setPending({ from: selected, to: square, options: matches });
  };

  const choosePromotion = (move: ChessMove) => {
    setPending(null);
    setSelected(null);
    onMove(move.san);
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-6)",
        padding: "var(--space-6)",
        minBlockSize: "100dvh",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <div
        style={{ position: "relative", flex: "1 1 420px", maxWidth: "70vh" }}
      >
        <svg
          viewBox="0 0 8 8"
          role="img"
          aria-label="Chess board"
          style={{ width: "100%", display: "block", userSelect: "none" }}
        >
          {orderedRanks.map((rank, row) =>
            orderedFiles.map((file, column) => {
              const square = `${file}${rank}`;
              const piece = pieces.get(square);
              const fileIndex = FILES.indexOf(file);
              const isTarget = targets.some(move => move.to === square);
              const tint = run(() => {
                if (square === checkedKing) return CHECK_TINT;
                if (square === selected) return SELECTED_TINT;
                if (square === lastMove?.from || square === lastMove?.to) {
                  return LAST_MOVE_TINT;
                }
                return null;
              });
              return (
                <g
                  key={square}
                  data-square={square}
                  onClick={() => handleSquare(square)}
                  style={{ cursor: interactive ? "pointer" : "default" }}
                >
                  <rect
                    x={column}
                    y={row}
                    width={1}
                    height={1}
                    fill={
                      isLightSquare(fileIndex, rank)
                        ? LIGHT_SQUARE
                        : DARK_SQUARE
                    }
                  />
                  {tint !== null && (
                    <rect x={column} y={row} width={1} height={1} fill={tint} />
                  )}
                  {column === 0 && (
                    <text
                      x={column + 0.06}
                      y={row + 0.22}
                      fontSize={0.16}
                      fill="var(--color-text-primary, #222)"
                    >
                      {rank}
                    </text>
                  )}
                  {row === 7 && (
                    <text
                      x={column + 0.78}
                      y={row + 0.95}
                      fontSize={0.16}
                      fill="var(--color-text-primary, #222)"
                    >
                      {file}
                    </text>
                  )}
                  {piece !== undefined && (
                    <text
                      x={column + 0.5}
                      y={row + 0.5}
                      fontSize={0.78}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={piece.color === "w" ? "#ffffff" : "#1a1a1a"}
                      stroke={piece.color === "w" ? "#1a1a1a" : "none"}
                      strokeWidth={0.015}
                    >
                      {GLYPHS[`${piece.color}${piece.type}`]}
                    </text>
                  )}
                  {isTarget && (
                    <circle
                      data-legal-target={square}
                      cx={column + 0.5}
                      cy={row + 0.5}
                      r={piece === undefined ? 0.14 : 0.42}
                      fill={
                        piece === undefined
                          ? "rgba(0, 0, 0, 0.35)"
                          : "transparent"
                      }
                      stroke={
                        piece === undefined ? "none" : "rgba(0, 0, 0, 0.45)"
                      }
                      strokeWidth={0.08}
                    />
                  )}
                </g>
              );
            }),
          )}
        </svg>

        {pending !== null && (
          <div
            role="dialog"
            aria-label="Choose a promotion piece"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
              background: "rgba(0, 0, 0, 0.6)",
            }}
          >
            {PROMOTION_ORDER.flatMap(letter => {
              const option = pending.options.find(
                move => move.promotion === letter,
              );
              return option === undefined ? [] : [{ letter, option }];
            }).map(({ letter, option }) => (
              <button
                key={letter}
                data-promotion={letter}
                aria-label={PROMOTION_NAMES[letter]}
                onClick={() => choosePromotion(option)}
                style={{
                  fontSize: "2rem",
                  lineHeight: 1,
                  padding: "var(--space-3)",
                  cursor: "pointer",
                  background: "var(--color-bg-secondary)",
                  color: "var(--color-text-primary)",
                  border: "2px solid var(--color-border-primary)",
                  borderRadius: "6px",
                }}
              >
                {letter.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          flex: "1 1 320px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          color: "var(--color-text-primary)",
          minWidth: 0,
        }}
      >
        {state.playerOrder.map((playerId, index) => (
          <div
            key={playerId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {index === 0 ? "White" : "Black"}
              {mover === playerId ? " to move" : ""}
            </span>
            <SeatSelector
              playerId={playerId}
              config={seats[playerId] ?? HUMAN_SEAT}
              options={seatOptions}
              defaultLlm={chessModule.defaultLlmSeat}
              onChange={config => onSeatChange?.(playerId, config)}
              disabled={onSeatChange === undefined}
            />
          </div>
        ))}

        {resultText(state) !== null && (
          <div
            role="status"
            style={{
              padding: "var(--space-4)",
              border: "1px solid var(--color-border-primary)",
              background: "var(--color-bg-secondary)",
              borderRadius: "6px",
              fontWeight: 700,
            }}
          >
            {resultText(state)}
          </div>
        )}

        <div
          style={{
            maxBlockSize: "14rem",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            border: "1px solid var(--color-border-primary)",
            background: "var(--color-bg-secondary)",
            borderRadius: "6px",
            padding: "var(--space-3)",
          }}
        >
          {movePairs(state.moves).map(pair => (
            <div key={pair.number} style={{ display: "flex", gap: "0.5rem" }}>
              <span style={{ opacity: 0.6, minWidth: "2rem" }}>
                {pair.number}.
              </span>
              <span style={{ minWidth: "5rem" }}>{pair.white}</span>
              <span>{pair.black}</span>
            </div>
          ))}
        </div>

        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}
        >
          {onNewGame !== undefined && (
            <SidebarButton onClick={onNewGame}>New Game</SidebarButton>
          )}
          {onTakeBack !== undefined && (
            <SidebarButton onClick={onTakeBack}>Take back</SidebarButton>
          )}
          {onResign !== undefined && (
            <SidebarButton onClick={onResign} disabled={state.gameOver}>
              Resign
            </SidebarButton>
          )}
          {onBack !== undefined && (
            <SidebarButton onClick={onBack}>Back to Menu</SidebarButton>
          )}
        </div>

        {hasLlmSeat(seats) && (
          <div
            style={{
              blockSize: "24rem",
              border: "1px solid var(--color-border-primary)",
              background: "var(--color-bg-secondary)",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <LLMLog
              entries={entries}
              seats={seats}
              {...(onSeatChange !== undefined && { onSeatChange })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarButton({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "var(--space-3) var(--space-5)",
        fontSize: "0.75rem",
        fontFamily: "inherit",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        background: "var(--color-victory-dark)",
        color: "#fff",
        border: "1px solid var(--color-victory)",
        borderRadius: "4px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
