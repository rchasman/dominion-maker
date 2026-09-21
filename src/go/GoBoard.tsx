import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { BoardButton } from "../components/BoardButton";
import type { SeatControl } from "../components/Board/seat-control";
import { run } from "../lib/run";
import { legalCandidates } from "./candidates";
import { goGame } from "./definition";
import {
  columnLabels,
  pointKey,
  pointLabel,
  stoneAt,
  type Point,
} from "./rules";
import { STONE_COLORS } from "./sidebar";
import type { GoSize, GoState } from "./shape";

const WOOD = "#dcb35c";
const GRID_LINE = "#5a3d1b";
const [BLACK_STONE, WHITE_STONE] = STONE_COLORS;
const STONE_RADIUS = 0.47;
const SHADOW = "rgba(0, 0, 0, 0.35)";
const GHOST_OPACITY = 0.5;

/** The lines whose crossings carry a star point, per board size */
const HOSHI_LINES: Record<GoSize, readonly number[]> = {
  9: [2, 4, 6],
  13: [3, 6, 9],
  19: [3, 9, 15],
};

interface GoBoardProps {
  state: GoState;
  /** The seat this client plays; its header sits under the board */
  localPlayerId: string | null;
  /** Player ids read as names where a player is named; ids alone otherwise */
  playerNames?: Record<string, string>;
  onPlace: (x: number, y: number) => void;
  onPass: () => void;
  /** What each player header shows for who plays the seat */
  seatControl: SeatControl;
  onTakeBack?: () => void;
  onResign?: () => void;
  disabled?: boolean;
}

/**
 * The small boards mark their corners and the centre; the full board marks
 * every crossing of its star lines.
 */
const hoshiPoints = (size: GoSize): Point[] => {
  const lines = HOSHI_LINES[size];
  const crossings = lines.flatMap(x => lines.map(y => ({ x, y })));
  if (size === 19) return crossings;
  return crossings.filter(
    point => point.x === point.y || point.x + point.y === size - 1,
  );
};

/** A player is their colour, unless the caller knows a name for the id */
const nameOf = (
  state: GoState,
  names: Record<string, string>,
  id: string,
): string => names[id] ?? (id === state.playerOrder[0] ? "Black" : "White");

const resultText = (
  state: GoState,
  names: Record<string, string>,
): string | null => {
  if (!state.gameOver) return null;
  const winner =
    state.winnerId === null ? null : nameOf(state, names, state.winnerId);
  if (state.result === "resignation") return `Resignation. ${winner} wins.`;
  if (state.result === "score" && state.score !== null) {
    if (winner === null) return "Draw";
    const margin = Math.abs(state.score.black - state.score.white);
    return `${winner} wins by ${margin} points.`;
  }
  return "Game over";
};

/** The point the last stone landed on; a pass leaves no mark */
const lastStoneOf = (state: GoState): Point | null => {
  const last = state.moves[state.moves.length - 1];
  return last === undefined || last === "pass" ? null : last;
};

/**
 * The Go game area: a goban drawn as SVG, a header per colour with its
 * captures, and the buttons that only make sense beside a board. The log,
 * the consensus viewer and the table controls belong to the shared sidebar.
 */
export function GoBoard({
  state,
  localPlayerId,
  playerNames = {},
  onPlace,
  onPass,
  seatControl,
  onTakeBack,
  onResign,
  disabled = false,
}: GoBoardProps) {
  const [hovered, setHovered] = useState<Point | null>(null);

  // A new position may make the hovered point illegal or occupied; the ghost
  // stone the last position drew must not outlive it.
  useEffect(() => {
    setHovered(null);
  }, [state.board]);

  const { size } = state;
  const mover = goGame.whoMustAct(state);
  // Every point the rules allow, not the voters' shortlist: a human may
  // self-atari or fill an eye if they choose to
  const legalPoints = useMemo(
    () =>
      new Set(
        (mover === null ? [] : legalCandidates(state)).map(candidate =>
          pointKey(candidate.point),
        ),
      ),
    [state, mover],
  );
  const lastStone = lastStoneOf(state);
  const hoshi = useMemo(() => hoshiPoints(size), [size]);
  const columns = columnLabels(size);
  const lines = Array.from({ length: size }, (_, index) => index);

  const [topPlayer, bottomPlayer] =
    localPlayerId === state.playerOrder[1]
      ? [state.playerOrder[0], state.playerOrder[1]]
      : [state.playerOrder[1], state.playerOrder[0]];

  /** A spectator, or a watcher of two bots, has no seat and so no Pass */
  const seated = localPlayerId !== null;
  const myMove = mover === localPlayerId;
  const interactive = myMove && !disabled;
  const isLegal = (point: Point) => legalPoints.has(pointKey(point));
  const canPlace = (point: Point) => interactive && isLegal(point);

  const ghost = hovered !== null && canPlace(hovered) ? hovered : null;
  const moverStone = mover === state.playerOrder[0] ? BLACK_STONE : WHITE_STONE;

  const result = resultText(state, playerNames);

  const header = (playerId: string) => (
    <PlayerHeader
      state={state}
      playerNames={playerNames}
      playerId={playerId}
      isMover={mover === playerId}
      control={playerId === localPlayerId ? seatControl(playerId) : null}
    />
  );

  const extent = size + 1.25;

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
            viewBox={`0 0 ${extent} ${extent}`}
            role="img"
            aria-label="Go board"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              userSelect: "none",
              touchAction: "manipulation",
            }}
          >
            <rect x={0} y={0} width={extent} height={extent} fill={WOOD} />
            {lines.map(line => (
              <g key={line}>
                <line
                  x1={1}
                  y1={line + 1}
                  x2={size}
                  y2={line + 1}
                  stroke={GRID_LINE}
                  strokeWidth={0.04}
                />
                <line
                  x1={line + 1}
                  y1={1}
                  x2={line + 1}
                  y2={size}
                  stroke={GRID_LINE}
                  strokeWidth={0.04}
                />
                <text
                  x={0.4}
                  y={line + 1}
                  fontSize={0.32}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={GRID_LINE}
                >
                  {size - line}
                </text>
                <text
                  x={line + 1}
                  y={size + 0.85}
                  fontSize={0.32}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={GRID_LINE}
                >
                  {columns[line]}
                </text>
              </g>
            ))}
            {hoshi.map(point => (
              <circle
                key={pointKey(point)}
                cx={point.x + 1}
                cy={point.y + 1}
                r={0.09}
                fill={GRID_LINE}
              />
            ))}
            {lines.flatMap(y =>
              lines.map(x => {
                const point = { x, y };
                const label = pointLabel(size, point);
                const stone = stoneAt(state.board, size, point);
                const isLast =
                  lastStone !== null && lastStone.x === x && lastStone.y === y;
                return (
                  <g
                    key={label}
                    data-point={label}
                    {...(isLegal(point) && { "data-legal": true })}
                    onClick={() => {
                      if (canPlace(point)) onPlace(x, y);
                    }}
                    onPointerEnter={() => setHovered(point)}
                    onPointerLeave={() => setHovered(null)}
                    style={{ cursor: canPlace(point) ? "pointer" : "default" }}
                  >
                    <rect
                      x={x + 0.5}
                      y={y + 0.5}
                      width={1}
                      height={1}
                      fill="transparent"
                    />
                    {(stone === "B" || stone === "W") && (
                      <Stone
                        stone={stone}
                        x={x + 1}
                        y={y + 1}
                        marked={isLast}
                      />
                    )}
                    {ghost !== null && ghost.x === x && ghost.y === y && (
                      <circle
                        data-ghost
                        cx={x + 1}
                        cy={y + 1}
                        r={STONE_RADIUS}
                        fill={moverStone}
                        opacity={GHOST_OPACITY}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </g>
                );
              }),
            )}
          </svg>
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

        {(seated || onTakeBack !== undefined || onResign !== undefined) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              justifyContent: "center",
            }}
          >
            {seated && (
              <BoardButton onClick={onPass} disabled={!interactive}>
                Pass
              </BoardButton>
            )}
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

function Stone({
  stone,
  x,
  y,
  marked,
}: {
  stone: "B" | "W";
  x: number;
  y: number;
  marked: boolean;
}) {
  const fill = stone === "B" ? BLACK_STONE : WHITE_STONE;
  const contrast = stone === "B" ? WHITE_STONE : BLACK_STONE;
  return (
    <g data-stone={stone}>
      <circle cx={x + 0.04} cy={y + 0.06} r={STONE_RADIUS} fill={SHADOW} />
      <circle
        cx={x}
        cy={y}
        r={STONE_RADIUS}
        fill={fill}
        stroke={stone === "W" ? "rgba(0, 0, 0, 0.3)" : "none"}
        strokeWidth={0.02}
      />
      {marked && (
        <circle data-last-move cx={x} cy={y} r={0.12} fill={contrast} />
      )}
    </g>
  );
}

interface PlayerHeaderProps {
  state: GoState;
  playerNames: Record<string, string>;
  playerId: string;
  isMover: boolean;
  /** The seat selector, on your own header only; every other seat shows none */
  control: VNode | null;
}

/** A player's name, their captures so far and who plays their seat */
function PlayerHeader({
  state,
  playerNames,
  playerId,
  isMover,
  control,
}: PlayerHeaderProps) {
  const index = state.playerOrder.indexOf(playerId);
  const captured = run(() => {
    if (index === 0) return state.captures[0];
    if (index === 1) return state.captures[1];
    return 0;
  });
  return (
    <div
      data-go-player={playerId}
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
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            inlineSize: "0.75rem",
            blockSize: "0.75rem",
            borderRadius: "50%",
            background: STONE_COLORS[index] ?? "transparent",
            border: "1px solid rgba(0, 0, 0, 0.3)",
          }}
        />
        {nameOf(state, playerNames, playerId)}
        {isMover ? " to move" : ""}
        <span
          data-go-captures={playerId}
          style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}
        >
          Captures: {captured}
        </span>
      </span>
      {control}
    </div>
  );
}
