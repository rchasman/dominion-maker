import type { GameDefinition } from "../core/game-definition";
import { sideToMove } from "./engine";
import { goHeuristic } from "./heuristic";
import { goEvaluate } from "./jev";
import { goPrompt, goPromptRow } from "./prompt";
import {
  legalPlacements,
  pointLabel,
  recordLabel,
  replayMoves,
  stoneOf,
  type Point,
} from "./rules";
import type { GoMove, GoShape, GoState } from "./shape";

const PASS: GoMove = { kind: "pass", label: "pass" };

const placementMove = (size: number, point: Point): GoMove => ({
  kind: "place",
  x: point.x,
  y: point.y,
  label: pointLabel(size, point),
});

/** Every point the rules allow, in board order, then the pass */
const movesOf = (state: GoState): GoMove[] => {
  const { positions } = replayMoves(state.size, state.moves);
  const stone = stoneOf(state.moves.length);
  const points = legalPlacements(state.size, state.board, positions, stone);
  return [...points.map(point => placementMove(state.size, point)), PASS];
};

export const goGame: GameDefinition<GoShape> = {
  id: "go",
  whoMustAct: state => (state.gameOver ? null : sideToMove(state)),
  players: state => [...state.playerOrder],
  legalMoves: state => (state.gameOver ? [] : movesOf(state)),
  moveToCommand: (_state, move, player) =>
    move.kind === "pass"
      ? { type: "PASS", playerId: player }
      : { type: "PLACE", playerId: player, x: move.x, y: move.y },
  moveKey: move => move.label,
  describeMove: move => move.label,
  promptRow: goPromptRow,
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  prompt: goPrompt,
  evaluate: goEvaluate,
  heuristic: goHeuristic,
  // turn and phase name the action id the consensus log builds, so they carry
  // the keys Dominion's payload carries. Go has one phase and it is a move.
  logContext: (state, player) => {
    const last = state.moves[state.moves.length - 1];
    return {
      turnId: `${player}-${state.moves.length}`,
      isChoice: false,
      payload: {
        turn: state.moves.length + 1,
        phase: "move",
        activePlayerId: player,
        size: state.size,
        board: state.board,
        captures: [...state.captures],
        moves: state.moves.map(move => recordLabel(state.size, move)),
        lastMove: last === undefined ? null : recordLabel(state.size, last),
      },
    };
  },
};
