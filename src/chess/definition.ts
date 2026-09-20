import { Chess } from "chess.js";
import type { GameDefinition } from "../core/game-definition";
import type { ChessShape, ChessState } from "./shape";

/** The player to move by the FEN, whether or not the game has ended */
const sideToMove = (state: ChessState) =>
  state.playerOrder[new Chess(state.fen).turn() === "w" ? 0 : 1];

/**
 * Task B2 fills in the prompt, the heuristic and the log payload the
 * consensus viewer renders. Everything here is what the rules alone decide.
 */
export const chessGame: GameDefinition<ChessShape> = {
  id: "chess",
  whoMustAct: state => (state.gameOver ? null : sideToMove(state)),
  players: state => [...state.playerOrder],
  legalMoves: state =>
    state.gameOver ? [] : new Chess(state.fen).moves().map(san => ({ san })),
  moveToCommand: (_state, move, player) => ({
    type: "MOVE",
    playerId: player,
    san: move.san,
  }),
  moveKey: move => move.san,
  describeMove: move => move.san,
  promptRow: move => ({ san: move.san }),
  withReasoning: (move, reasoning) => ({ ...move, reasoning }),
  reasoningOf: move => move.reasoning,
  prompt: () => ({ system: "", user: "" }),
  logContext: state => ({
    turnId: String(state.moves.length),
    isChoice: false,
    payload: {},
  }),
};
