import { Chess } from "chess.js";
import type { GameDefinition } from "../core/game-definition";
import { sideToMove } from "./engine";
import { chessHeuristic } from "./heuristic";
import { chessPrompt, chessPromptRow } from "./prompt";
import type { ChessMove, ChessShape } from "./shape";

/**
 * chess.js reports `promotion` and `captured` only when they apply, and the
 * project types optionals exactly, so an absent field stays absent.
 */
const toChessMove = (verbose: {
  san: string;
  from: string;
  to: string;
  promotion?: string | undefined;
  captured?: string | undefined;
}): ChessMove => ({
  san: verbose.san,
  from: verbose.from,
  to: verbose.to,
  ...(verbose.promotion === undefined ? {} : { promotion: verbose.promotion }),
  ...(verbose.captured === undefined ? {} : { captured: verbose.captured }),
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
  describeMove: move => move.san,
  promptRow: chessPromptRow,
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  prompt: chessPrompt,
  heuristic: chessHeuristic,
  // turn and phase name the action id the consensus log builds, so they carry
  // the keys Dominion's payload carries. Chess has one phase and it is a move.
  logContext: (state, player, moves) => ({
    turnId: `${player}-${state.moves.length}`,
    isChoice: false,
    payload: {
      turn: Math.floor(state.moves.length / 2) + 1,
      phase: "move",
      activePlayerId: player,
      fen: state.fen,
      moves: [...state.moves],
      legalActions: moves.map(move => move.san),
      lastMove: state.moves[state.moves.length - 1] ?? null,
    },
  }),
};
