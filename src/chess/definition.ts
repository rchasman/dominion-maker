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
const toMove = (verbose: {
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
      : new Chess(state.fen).moves({ verbose: true }).map(toMove),
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
  // turnId is the ply so every move opens its own group; moveNumber is the
  // full move the players would write on a scoresheet.
  logContext: state => ({
    turnId: String(state.moves.length),
    isChoice: false,
    payload: {
      fen: state.fen,
      sideToMove: sideToMove(state),
      moveNumber: Math.floor(state.moves.length / 2) + 1,
      lastMove: state.moves[state.moves.length - 1] ?? null,
    },
  }),
};
