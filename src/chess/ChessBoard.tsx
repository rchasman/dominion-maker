import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Chess } from "chess.js";
import type { ControllerConfig, Seats } from "../core/seats";
import { HUMAN_SEAT } from "../core/seats";
import { BoardButton } from "../components/BoardButton";
import { DEFAULT_SEAT_OPTIONS, SeatSelector } from "../components/SeatSelector";
import { run } from "../lib/run";
import { chessGame } from "./definition";
import { chessModule } from "./module";
import { replayMoves } from "./replay";
import type { ChessMove, ChessState } from "./shape";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const PROMOTION_ORDER = ["q", "r", "b", "n"] as const;

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

/** A piece held by the pointer; `at` is in board units once the pointer moved */
type Drag = { from: string; at: { x: number; y: number } | null };

interface ChessBoardProps {
  state: ChessState;
  seats: Seats;
  /** The seat this client plays; the board flips when it is Black */
  localPlayerId: string | null;
  /** Player ids read as names where a player is named; ids alone otherwise */
  playerNames?: Record<string, string>;
  onMove: (san: string) => void;
  /** Omitted where the table is not this client's to change */
  onSeatChange?: (player: string, config: ControllerConfig) => void;
  onTakeBack?: () => void;
  onResign?: () => void;
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

/** A player is their colour, unless the caller knows a name for the id */
const nameOf = (
  state: ChessState,
  names: Record<string, string>,
  id: string,
): string => names[id] ?? (id === state.playerOrder[0] ? "White" : "Black");

const resultText = (
  state: ChessState,
  names: Record<string, string>,
): string | null => {
  if (!state.gameOver) return null;
  const winner =
    state.winnerId === null ? null : nameOf(state, names, state.winnerId);
  if (state.result === "stalemate") return "Draw by stalemate";
  if (state.result === "draw") return "Draw";
  if (state.result === "checkmate") return `Checkmate. ${winner} wins.`;
  if (state.result === "resignation") return `Resignation. ${winner} wins.`;
  return "Game over";
};

/**
 * The squares the last move touched. The position itself comes from the FEN,
 * so a log this client cannot replay costs the board its last-move tint and
 * nothing else.
 */
const lastMoveOf = (
  moves: readonly string[],
): { from: string; to: string } | null => replayMoves(moves)?.at(-1) ?? null;

/**
 * The chess game area: an 8x8 SVG board, the promotion picker, a header per
 * colour and the two buttons that only make sense beside a board. The log,
 * the consensus viewer and the table controls belong to the shared sidebar.
 */
export function ChessBoard({
  state,
  seats,
  localPlayerId,
  playerNames = {},
  onMove,
  onSeatChange,
  onTakeBack,
  onResign,
  disabled = false,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // A new position is a new set of legal moves: a picker or a selection the
  // last position opened would send a move this one does not have.
  useEffect(() => {
    setPending(null);
    setSelected(null);
    setDrag(null);
  }, [state.fen]);

  // A release off the board puts the piece back; the square stays selected so
  // a tap on a target still completes the move.
  useEffect(() => {
    if (drag === null) return;
    const release = () => setDrag(null);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [drag]);

  const board = useMemo(() => new Chess(state.fen), [state.fen]);

  const mover = chessGame.whoMustAct(state);
  const legalMoves = useMemo(
    () => (mover === null ? [] : chessGame.legalMoves(state, mover)),
    [state, mover],
  );
  const pieces = piecesOf(board.board());
  const lastMove = useMemo(() => lastMoveOf(state.moves), [state.moves]);
  const checkedKing = run(() => {
    if (!state.inCheck) return null;
    const side = board.turn();
    const entry = [...pieces.entries()].find(
      ([, piece]) => piece.type === "k" && piece.color === side,
    );
    return entry?.[0] ?? null;
  });

  const flipped = localPlayerId === state.playerOrder[1];
  const orderedFiles = flipped ? [...FILES].reverse() : [...FILES];
  const orderedRanks = flipped ? [...RANKS].reverse() : [...RANKS];
  const [topPlayer, bottomPlayer] = flipped
    ? [state.playerOrder[0], state.playerOrder[1]]
    : [state.playerOrder[1], state.playerOrder[0]];

  const myMove = mover === localPlayerId;
  const interactive = myMove && !disabled;
  const targets = legalMoves.filter(move => move.from === selected);

  const canMoveFrom = (square: string) =>
    legalMoves.some(move => move.from === square);

  /** Sends the move `from` → `to`, or opens the picker when it promotes */
  const playTo = (from: string, to: string): boolean => {
    const matches = legalMoves.filter(
      move => move.from === from && move.to === to,
    );
    const only = matches[0];
    if (only === undefined) return false;
    if (matches.length === 1) {
      setSelected(null);
      onMove(only.san);
      return true;
    }
    setPending({ from, to, options: matches });
    return true;
  };

  /** Pressing a piece picks it up; pressing anywhere else is a click on it */
  const handlePress = (square: string, event: PointerEvent) => {
    if (!interactive || pending !== null) return;
    event.preventDefault();
    if (canMoveFrom(square)) {
      setSelected(square);
      setDrag({ from: square, at: null });
      return;
    }
    if (selected !== null && playTo(selected, square)) return;
    setSelected(null);
  };

  /** Releasing on the square the piece left keeps it selected for a tap */
  const handleRelease = (square: string) => {
    if (drag === null) return;
    setDrag(null);
    if (square === drag.from) return;
    if (!playTo(drag.from, square)) setSelected(null);
  };

  const handleDragMove = (event: PointerEvent) => {
    if (drag === null) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) return;
    setDrag({
      from: drag.from,
      at: {
        x: ((event.clientX - rect.left) / rect.width) * 8,
        y: ((event.clientY - rect.top) / rect.height) * 8,
      },
    });
  };

  const heldPiece = drag === null ? undefined : pieces.get(drag.from);

  const squareCursor = (square: string): string => {
    if (!interactive) return "default";
    if (drag !== null) return "grabbing";
    return canMoveFrom(square) ? "grab" : "pointer";
  };

  const result = resultText(state, playerNames);

  const choosePromotion = (move: ChessMove) => {
    setPending(null);
    setSelected(null);
    onMove(move.san);
  };

  const header = (playerId: string | undefined) =>
    playerId === undefined ? null : (
      <PlayerHeader
        state={state}
        seats={seats}
        playerNames={playerNames}
        playerId={playerId}
        isMover={mover === playerId}
        {...(onSeatChange !== undefined && { onSeatChange })}
      />
    );

  return (
    <>
      {header(topPlayer)}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minBlockSize: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            blockSize: "100%",
            aspectRatio: "1 / 1",
            maxInlineSize: "100%",
          }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 8 8"
            role="img"
            aria-label="Chess board"
            onPointerMove={handleDragMove}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              userSelect: "none",
              touchAction: "none",
            }}
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
                    onPointerDown={event => handlePress(square, event)}
                    onPointerUp={() => handleRelease(square)}
                    style={{ cursor: squareCursor(square) }}
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
                      <rect
                        x={column}
                        y={row}
                        width={1}
                        height={1}
                        fill={tint}
                      />
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
                      <PieceGlyph
                        piece={piece}
                        x={column + 0.5}
                        y={row + 0.5}
                        opacity={
                          drag?.at !== null && drag?.from === square ? 0.3 : 1
                        }
                      />
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
            {heldPiece !== undefined && drag?.at && (
              <g data-drag-ghost style={{ pointerEvents: "none" }}>
                <PieceGlyph piece={heldPiece} x={drag.at.x} y={drag.at.y} />
              </g>
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
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          color: "var(--color-text-primary)",
        }}
      >
        {result !== null && (
          <div
            role="status"
            style={{
              padding: "var(--space-3)",
              border: "1px solid var(--color-border-primary)",
              background: "var(--color-bg-secondary)",
              borderRadius: "6px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {result}
          </div>
        )}

        {header(bottomPlayer)}

        {(onTakeBack !== undefined || onResign !== undefined) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              justifyContent: "center",
            }}
          >
            {onTakeBack !== undefined && (
              <BoardButton onClick={onTakeBack}>Take back</BoardButton>
            )}
            {onResign !== undefined && (
              <BoardButton onClick={onResign} disabled={state.gameOver}>
                Resign
              </BoardButton>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function PieceGlyph({
  piece,
  x,
  y,
  opacity = 1,
}: {
  piece: Piece;
  x: number;
  y: number;
  opacity?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={0.78}
      textAnchor="middle"
      dominantBaseline="central"
      fill={piece.color === "w" ? "#ffffff" : "#1a1a1a"}
      stroke={piece.color === "w" ? "#1a1a1a" : "none"}
      strokeWidth={0.015}
      opacity={opacity}
    >
      {GLYPHS[`${piece.color}${piece.type}`]}
    </text>
  );
}

interface PlayerHeaderProps {
  state: ChessState;
  seats: Seats;
  playerNames: Record<string, string>;
  playerId: string;
  isMover: boolean;
  onSeatChange?: (player: string, config: ControllerConfig) => void;
}

function PlayerHeader({
  state,
  seats,
  playerNames,
  playerId,
  isMover,
  onSeatChange,
}: PlayerHeaderProps) {
  return (
    <div
      data-chess-player={playerId}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        background: "var(--color-bg-surface)",
        color: "var(--color-text-primary)",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {nameOf(state, playerNames, playerId)}
        {isMover ? " to move" : ""}
      </span>
      <SeatSelector
        playerId={playerId}
        config={seats[playerId] ?? HUMAN_SEAT}
        options={DEFAULT_SEAT_OPTIONS}
        defaultLlm={chessModule.defaultLlmSeat}
        onChange={config => onSeatChange?.(playerId, config)}
        disabled={onSeatChange === undefined}
      />
    </div>
  );
}
