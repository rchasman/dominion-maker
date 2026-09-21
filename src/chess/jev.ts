import { Chess, type Move } from "chess.js";
import { askJevChoice } from "../agent/jev-evaluate";
import {
  jevOptionKey,
  type JevChoiceQuestion,
  type JsonObject,
} from "../agent/jev-protocol";
import type { EvaluateInput } from "../core/game-definition";
import { describeMove, moveFacts, pieceName } from "./describe-move";
import { moveNumberOf } from "./engine";
import { describeMaterial, materialOf, PIECE_VALUES } from "./material";
import { colourName, colourToMove, RECALLED_MOVES } from "./prompt";
import type { ChessMove, ChessShape, ChessState } from "./shape";

// Chess's side of the Jev protocol. Jev cannot read a FEN or work out what a
// move does, so every option states the facts chess.js proves about it and
// the state spells the board out square by square.

const EMPTY_SQUARE = ".";

const BOARD_KEY =
  "Rows run from rank 8 at the top down to rank 1, columns from file a to file h. Uppercase letters are White's pieces and lowercase are Black's: K king, Q queen, R rook, B bishop, N knight, P pawn. A dot is an empty square.";

/** "a queen 9, a rook 5, ...": the values Jev is told, read off the same record the heuristic counts with */
const PIECE_VALUES_TEXT = Object.entries(PIECE_VALUES)
  .map(([symbol, value]) => `a ${pieceName(symbol).toLowerCase()} ${value}`)
  .join(", ");

/** Everything chess.js proves about one legal move, in the words a player uses */
const describeOption = (verbose: Move): string => {
  return [
    `${pieceName(verbose.piece)} from ${verbose.from} to ${verbose.to}`,
    ...moveFacts(describeMove(verbose)),
  ].join(". ");
};

const instructions = (colour: string, inCheck: boolean): string =>
  `You are ${colour} and it is your move${inCheck ? ", and your king is in check" : ""}. Which move should you play now? Every option is a legal move and its description states what the move does on the board; those facts are binding. Prefer a move that gives checkmate. Win material and do not give it away. Piece values in pawns: ${PIECE_VALUES_TEXT}. Keep your king safe and develop your pieces towards the centre. When \`strategyOverride\` is present, follow it. Pick the option that most improves ${colour}'s chance of winning this game of chess.`;

/** One option per legal move, keyed by its number in the table so duplicate SANs cannot collide */
export function chessJevQuestion(
  state: ChessState,
  moves: ChessMove[],
): JevChoiceQuestion<ChessMove> {
  const board = new Chess(state.fen);
  const verboseBySan = new Map(
    board.moves({ verbose: true }).map(move => [move.san, move]),
  );
  return {
    instructions: instructions(colourToMove(board), state.inCheck),
    options: moves.map((move, index) => {
      const verbose = verboseBySan.get(move.san);
      if (!verbose) throw new Error(`${move.san} is not legal in ${state.fen}`);
      return {
        key: jevOptionKey(index, move.san),
        description: describeOption(verbose),
        move,
      };
    }),
  };
}

const boardMatrix = (board: Chess): string[][] =>
  board.board().map(rank =>
    rank.map(cell => {
      if (cell === null) return EMPTY_SQUARE;
      return cell.color === "w" ? cell.type.toUpperCase() : cell.type;
    }),
  );

/** Every occupied square named in full, so no piece has to be read off the matrix */
const piecesBySquare = (board: Chess): JsonObject =>
  Object.fromEntries(
    board
      .board()
      .flat()
      .flatMap(cell =>
        cell === null
          ? []
          : [
              [
                cell.square,
                `${colourName(cell.color).toLowerCase()} ${pieceName(cell.type).toLowerCase()}`,
              ],
            ],
      ),
  );

export function chessJevState(
  state: ChessState,
  customStrategy: string,
): JsonObject {
  const board = new Chess(state.fen);
  const material = materialOf(board);
  const recentMoves = state.moves.slice(-RECALLED_MOVES);
  const strategy = customStrategy.trim();
  return {
    game: "chess",
    sideToMove: colourToMove(board),
    inCheck: state.inCheck,
    moveNumber: moveNumberOf(state),
    fen: state.fen,
    boardKey: BOARD_KEY,
    board: boardMatrix(board),
    pieces: piecesBySquare(board),
    material: { ...material, summary: describeMaterial(material) },
    ...(recentMoves.length > 0 ? { recentMoves } : {}),
    ...(strategy.length > 0 ? { strategyOverride: strategy } : {}),
  };
}

export async function chessEvaluate({
  modelId,
  state,
  moves,
  customStrategy,
}: EvaluateInput<ChessShape>) {
  const vote = await askJevChoice({
    modelId,
    state: chessJevState(state, customStrategy),
    question: chessJevQuestion(state, moves),
    extraQuestions: {},
  });
  return {
    move: { ...vote.move, reasoning: vote.reasoning },
    distribution: vote.distribution,
    usage: vote.usage,
  };
}
