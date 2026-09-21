import { Chess } from "chess.js";
import { askJevChoice } from "../agent/jev-evaluate";
import {
  jevOptionKey,
  type JevChoiceQuestion,
  type JsonObject,
} from "../agent/jev-protocol";
import type { EvaluateInput } from "../core/game-definition";
import { plural } from "../lib/plural";
import { moveNumberOf } from "./engine";
import {
  captureText,
  describeMaterial,
  effectTexts,
  isCheckmate,
  legalMoveFacts,
  PIECE_VALUES_TEXT,
  positionFacts,
  worthText,
  type Capture,
  type MoveFacts,
  type PieceGroup,
  type PositionFacts,
} from "./facts";
import { colourName, RECALLED_MOVES } from "./prompt";
import type { ChessMove, ChessShape, ChessState } from "./shape";

// Chess's side of the Jev protocol. Jev cannot read a FEN or work out what a
// move does, so every option states the facts chess.js proves about it, one
// move ahead, and the state spells the board out square by square.

const EMPTY_SQUARE = ".";

const BOARD_KEY =
  "Rows run from rank 8 at the top down to rank 1, columns from file a to file h. Uppercase letters are White's pieces and lowercase are Black's: K king, Q queen, R rook, B bishop, N knight, P pawn. A dot is an empty square.";

/** Where the piece lands: who can legally take there and who can take back once the move is made */
const landingSentence = (facts: MoveFacts): string => {
  const cheapest =
    facts.cheapestAttacker === null
      ? ""
      : ` (cheapest: ${worthText(facts.cheapestAttacker)})`;
  return `After it ${facts.to} is attacked by ${plural(facts.attackers, "enemy piece")}${cheapest} and guarded by ${plural(facts.defenders, "own piece")}`;
};

const replySentence = (capture: Capture | null): string =>
  capture === null
    ? "The opponent has no capture in reply"
    : `The opponent's best reply takes your ${captureText(capture)}`;

/** Everything chess.js proves about one legal move, in the words a player uses */
const describeOption = (facts: MoveFacts): string => {
  const effects = effectTexts(facts);
  const head = `${facts.piece} from ${facts.from} to ${facts.to}${effects.length > 0 ? `: ${effects.join(", ")}` : ""}`;
  if (isCheckmate(facts)) return `${head}. The game ends won`;
  return [
    head,
    landingSentence(facts),
    replySentence(facts.opponentBestCapture),
  ].join(". ");
};

const instructions = (colour: string, inCheck: boolean): string =>
  `You are ${colour} and it is your move${inCheck ? ", and your king is in check" : ""}. Which move should you play now? Every option is a legal move and its description states what the move does on the board, who attacks and guards the square it lands on (attackers are enemy pieces with a legal capture there; guards are your pieces that can legally take back), and the most valuable piece the opponent can then take in reply; those facts are binding. A checkmate ends the game won. Piece values in pawns: ${PIECE_VALUES_TEXT}. A piece that lands where it is attacked and guarded by no own piece is lost for whatever the move took; a piece attacked by a cheaper piece loses the difference even when a recapture follows. When \`strategyOverride\` is present, follow it. Pick the option that most improves ${colour}'s chance of winning this game of chess.`;

/** One option per legal move, keyed by its number in the table so duplicate SANs cannot collide */
export function chessJevQuestion(
  state: ChessState,
  moves: ChessMove[],
): JevChoiceQuestion<ChessMove> {
  return {
    instructions: instructions(
      colourName(new Chess(state.fen).turn()),
      state.inCheck,
    ),
    options: legalMoveFacts(state.fen, moves).map(({ move, facts }, index) => ({
      key: jevOptionKey(index, move.san),
      description: describeOption(facts),
      move,
    })),
  };
}

const boardMatrix = (board: Chess): string[][] =>
  board.board().map(rank =>
    rank.map(cell => {
      if (cell === null) return EMPTY_SQUARE;
      return cell.color === "w" ? cell.type.toUpperCase() : cell.type;
    }),
  );

/** One side's pieces by kind and square, so no piece has to be read off the matrix or inferred from the moves */
const piecesJson = (groups: readonly PieceGroup[]): JsonObject =>
  Object.fromEntries(groups.map(({ piece, squares }) => [piece, squares]));

const captureJson = (capture: Capture | null): JsonObject | null =>
  capture === null
    ? null
    : { piece: capture.piece, value: capture.value, square: capture.square };

/** The mover's pieces that can be taken for nothing, each with what attacks it */
const undefendedJson = (facts: PositionFacts): JsonObject[] =>
  facts.undefended.map(piece => ({
    piece: piece.piece,
    value: piece.value,
    square: piece.square,
    attackers: piece.attackers,
    cheapestAttacker: worthText(piece.cheapestAttacker),
  }));

export function chessJevState(
  state: ChessState,
  customStrategy: string,
): JsonObject {
  const board = new Chess(state.fen);
  const facts = positionFacts(state.fen);
  const recentMoves = state.moves.slice(-RECALLED_MOVES);
  const strategy = customStrategy.trim();
  return {
    game: "chess",
    sideToMove: colourName(facts.sideToMove),
    inCheck: state.inCheck,
    moveNumber: moveNumberOf(state),
    fen: state.fen,
    boardKey: BOARD_KEY,
    board: boardMatrix(board),
    pieces: {
      white: piecesJson(facts.pieces.white),
      black: piecesJson(facts.pieces.black),
    },
    material: { ...facts.material, summary: describeMaterial(facts.material) },
    castlingRights: {
      white: { ...facts.castling.white },
      black: { ...facts.castling.black },
    },
    yourPiecesAttackedAndUndefended: undefendedJson(facts),
    opponentBestCaptureIfYouDoNothing: captureJson(facts.opponentBestCapture),
    ...(recentMoves.length > 0
      ? { recentMovesAlreadyPlayed: recentMoves }
      : {}),
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
