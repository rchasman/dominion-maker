import { createGoGame, type GoEngine } from "./engine";
import {
  DEFAULT_GO_SIZE,
  type GoCommand,
  type GoMoveRecord,
  type GoPlayerOrder,
  type GoSize,
  type GoState,
} from "./shape";

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
