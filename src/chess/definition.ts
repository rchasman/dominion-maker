import { Chess } from "chess.js";
import type { GameDefinition } from "../core/game-definition";
import { moveNumberOf, sideToMove } from "./engine";
import { legalMoveLabel } from "./facts";
import { chessHeuristic } from "./heuristic";
import { chessEvaluate } from "./jev";
import { chessPrompt } from "./prompt";
import type { ChessMove, ChessShape } from "./shape";

/**
 * chess.js reports `promotion` only when it applies, and the project types
 * optionals exactly, so an absent field stays absent.
 */
const toChessMove = (verbose: {
  san: string;
  from: string;
  to: string;
  promotion?: string | undefined;
}): ChessMove => ({
  san: verbose.san,
  from: verbose.from,
  to: verbose.to,
  ...(verbose.promotion === undefined ? {} : { promotion: verbose.promotion }),
});

export const chessGame: GameDefinition<ChessShape> = {
  id: "chess",
  whoMustAct: state => (state.gameOver ? null : sideToMove(state)),
  players: state => [...state.playerOrder],
  legalMoves: state =>
    state.gameOver
      ? []
      : new Chess(state.fen).moves({ verbose: true }).map(toChessMove),
  moveToCommand: (_state, move, player) => ({
    type: "MOVE",
    playerId: player,
    san: move.san,
  }),
  moveKey: move => move.san,
  // The vote panes print this beside a model's prose, so it carries what
  // chess.js proves the move does, not only its SAN
  describeMove: (state, move) => legalMoveLabel(state.fen, move),
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  prompt: chessPrompt,
  evaluate: chessEvaluate,
  heuristic: chessHeuristic,
  // turn and phase name the action id the consensus log builds, so they carry
  // the keys Dominion's payload carries. Chess has one phase and it is a move.
  logContext: (state, player) => ({
    turnId: `${player}-${state.moves.length}`,
    isChoice: false,
    payload: {
      turn: moveNumberOf(state),
      phase: "move",
      activePlayerId: player,
      fen: state.fen,
      moves: [...state.moves],
      lastMove: state.moves[state.moves.length - 1] ?? null,
    },
  }),
};
