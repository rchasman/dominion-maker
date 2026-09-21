import type { GameDefinition } from "../core/game-definition";
import { offeredMoves, passWinsNow } from "./candidates";
import { sideToMove } from "./engine";
import { goHeuristic } from "./heuristic";
import { goEvaluate } from "./jev";
import { goPrompt } from "./prompt";
import { recordLabel } from "./rules";
import type { GoShape } from "./shape";

export const goGame: GameDefinition<GoShape> = {
  id: "go",
  whoMustAct: state => (state.gameOver ? null : sideToMove(state)),
  players: state => [...state.playerOrder],
  legalMoves: state => (state.gameOver ? [] : offeredMoves(state)),
  // The same rule the heuristic and the pass gate follow: a pass that ends the
  // game won needs no vote
  autoMove: (state, _player, moves) =>
    passWinsNow(state) ? moves.find(move => move.kind === "pass") : undefined,
  moveToCommand: (_state, move, player) =>
    move.kind === "pass"
      ? { type: "PASS", playerId: player }
      : { type: "PLACE", playerId: player, x: move.x, y: move.y },
  moveKey: move => move.label,
  describeMove: (_state, move) => move.label,
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
