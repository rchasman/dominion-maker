import { createGoGame, type GoEngine } from "./engine";
import {
  DEFAULT_GO_SIZE,
  type GoCommand,
  type GoMove,
  type GoMoveRecord,
  type GoPlayerOrder,
  type GoSize,
  type GoState,
} from "./shape";

/**
 * A position drawn as rows from the top edge down, spaces ignored, on the
 * default board. `moves` is the record the state carries: its length names
 * the side to move and its last entry says whether the opponent just passed.
 */
export const goStateFromRows = (
  players: GoPlayerOrder,
  rows: readonly string[],
  moves: readonly GoMoveRecord[] = [],
): GoState => {
  if (rows.length !== DEFAULT_GO_SIZE)
    throw new Error(`Expected ${DEFAULT_GO_SIZE} rows, got ${rows.length}`);
  return {
    size: DEFAULT_GO_SIZE,
    board: rows.map(row => row.replaceAll(" ", "")).join(""),
    playerOrder: players,
    moves: [...moves],
    captures: [0, 0],
    consecutivePasses: 0,
    gameOver: false,
    winnerId: null,
    result: null,
    score: null,
  };
};

/** The placement move a voter would pick, named the way the table names it */
export const placedStone = (x: number, y: number, label: string): GoMove => ({
  kind: "place",
  x,
  y,
  label,
});

const commandFor = (playerId: string, move: GoMoveRecord): GoCommand =>
  move === "pass"
    ? { type: "PASS", playerId }
    : { type: "PLACE", playerId, x: move.x, y: move.y };

/** Plays the moves in turn order, Black first, and throws on the first one the engine refuses */
export const playGoMoves = (
  engine: GoEngine,
  players: GoPlayerOrder,
  moves: readonly GoMoveRecord[],
) =>
  moves.map((move, index) => {
    const playerId = index % 2 === 0 ? players[0] : players[1];
    const result = engine.dispatch(commandFor(playerId, move), playerId);
    if (!result.ok) throw new Error(result.error);
    return result;
  });

/** The state of a fresh game after the moves, Black first */
export const goStateAfter = (
  players: GoPlayerOrder,
  moves: readonly GoMoveRecord[],
  size: GoSize = DEFAULT_GO_SIZE,
): GoState => {
  const engine = createGoGame([...players], { size });
  playGoMoves(engine, players, moves);
  return engine.state;
};
