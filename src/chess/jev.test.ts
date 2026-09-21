import { describe, expect, it } from "bun:test";
import { readJevChoice, type JevChoiceQuestion } from "../agent/jev-protocol";
import { chessGame } from "./definition";
import { createChessGame } from "./engine";
import { chessEvaluate, chessJevQuestion, chessJevState } from "./jev";
import type { ChessMove, ChessState } from "./shape";
import { chessStateAfter } from "./test-helpers";

const WHITE = "w";
const BLACK = "b";

const positioned = (fen: string, inCheck = false): ChessState => ({
  fen,
  playerOrder: [WHITE, BLACK],
  moves: [],
  gameOver: false,
  winnerId: null,
  result: null,
  inCheck,
});

const played = (sans: string[]): ChessState =>
  chessStateAfter([WHITE, BLACK], sans);

const questionFor = (state: ChessState) =>
  chessJevQuestion(state, chessGame.legalMoves(state, WHITE));

const descriptionOf = (
  question: JevChoiceQuestion<ChessMove>,
  san: string,
): string | null | undefined =>
  question.options.find(option => option.move.san === san)?.description;

describe("chessJevQuestion", () => {
  it("offers every legal move once, keyed by its table number and SAN", () => {
    const state = createChessGame([WHITE, BLACK]).state;
    const moves = chessGame.legalMoves(state, WHITE);
    const question = chessJevQuestion(state, moves);
    expect(question.options).toHaveLength(20);
    expect(question.options.map(option => option.key)).toEqual(
      moves.map((move, index) => `${index + 1}. ${move.san}`),
    );
    expect(new Set(question.options.map(option => option.key)).size).toBe(20);
    expect(question.options.map(option => option.move)).toEqual(moves);
  });

  it("names the piece and its squares on a quiet move", () => {
    const question = questionFor(createChessGame([WHITE, BLACK]).state);
    expect(descriptionOf(question, "e4")).toBe("Pawn from e2 to e4");
    expect(descriptionOf(question, "Nf3")).toBe("Knight from g1 to f3");
  });

  it("states what a capture takes", () => {
    const question = questionFor(played(["e4", "d5"]));
    expect(descriptionOf(question, "exd5")).toBe(
      "Pawn from e4 to d5. Takes Pawn",
    );
  });

  it("states castling, check, checkmate, promotion and en passant", () => {
    expect(
      descriptionOf(
        questionFor(positioned("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")),
        "O-O",
      ),
    ).toBe("King from e1 to g1. Castles kingside");
    expect(
      descriptionOf(
        questionFor(positioned("4k3/8/8/8/8/8/8/4K2R w K - 0 1")),
        "Rh8+",
      ),
    ).toBe("Rook from h1 to h8. Check");
    expect(
      descriptionOf(
        questionFor(positioned("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")),
        "Ra8#",
      ),
    ).toBe("Rook from a1 to a8. Checkmate");
    expect(
      descriptionOf(
        questionFor(positioned("8/P7/8/8/8/8/8/k6K w - - 0 1")),
        "a8=Q+",
      ),
    ).toBe("Pawn from a7 to a8. Promotes to Queen. Check");
    expect(
      descriptionOf(
        questionFor(
          positioned(
            "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
          ),
        ),
        "exf6",
      ),
    ).toBe("Pawn from e5 to f6. Takes Pawn. En passant");
  });

  it("tells the mover its colour and whether it is in check", () => {
    const quiet = questionFor(createChessGame([WHITE, BLACK]).state);
    expect(quiet.instructions).toContain("You are White and it is your move.");
    expect(quiet.instructions).toContain(
      "Piece values in pawns: a queen 9, a rook 5, a bishop 3, a knight 3, a pawn 1.",
    );
    expect(quiet.instructions).not.toContain("in check");
    const checked = questionFor(
      positioned("4k3/8/8/8/8/8/8/r3K3 w - - 0 1", true),
    );
    expect(checked.instructions).toContain("your king is in check");
  });

  it("refuses a move that is not legal in the position", () => {
    const state = createChessGame([WHITE, BLACK]).state;
    expect(() =>
      chessJevQuestion(state, [{ san: "Qh5", from: "d1", to: "h5" }]),
    ).toThrow("Qh5 is not legal");
  });

  it("maps Jev's distribution back onto the legal moves", () => {
    const state = createChessGame([WHITE, BLACK]).state;
    const question = questionFor(state);
    const read = readJevChoice(
      {
        type: "choice",
        choice: "10. e4",
        probabilities: { "10. e4": 0.6, "8. d4": 0.3, "1. a3": 0.005 },
      },
      question.options,
    );
    expect(read.move).toEqual({ san: "e4", from: "e2", to: "e4" });
    expect(read.reasoning).toBe(
      "Jev picked this with 60% probability. Runner-up: d4 (30%).",
    );
    expect(read.distribution).toEqual([
      { move: { san: "e4", from: "e2", to: "e4" }, weight: 0.6 },
      { move: { san: "d4", from: "d2", to: "d4" }, weight: 0.3 },
    ]);
  });
});

describe("chessJevState", () => {
  it("spells the opening position out as an 8x8 matrix and named pieces", () => {
    const state = createChessGame([WHITE, BLACK]).state;
    const jevState = chessJevState(state, "");
    expect(jevState.sideToMove).toBe("White");
    expect(jevState.inCheck).toBe(false);
    expect(jevState.moveNumber).toBe(1);
    expect(jevState.fen).toBe(state.fen);
    expect(jevState.board).toEqual([
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      [".", ".", ".", ".", ".", ".", ".", "."],
      [".", ".", ".", ".", ".", ".", ".", "."],
      [".", ".", ".", ".", ".", ".", ".", "."],
      [".", ".", ".", ".", ".", ".", ".", "."],
      ["P", "P", "P", "P", "P", "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"],
    ]);
    expect(jevState.pieces).toMatchObject({
      e1: "white king",
      d8: "black queen",
      g1: "white knight",
    });
    expect(jevState.material).toEqual({
      white: 39,
      black: 39,
      summary: "Material is level.",
    });
    expect(jevState).not.toHaveProperty("recentMoves");
    expect(jevState).not.toHaveProperty("strategyOverride");
  });

  it("counts material after a capture and recalls the recent moves", () => {
    const jevState = chessJevState(played(["e4", "d5", "exd5"]), "");
    expect(jevState.sideToMove).toBe("Black");
    expect(jevState.material).toEqual({
      white: 39,
      black: 38,
      summary: "White is ahead by 1 pawn of material.",
    });
    expect(jevState.recentMoves).toEqual(["e4", "d5", "exd5"]);
    expect(jevState.moveNumber).toBe(2);
  });

  it("carries the trimmed strategy override only when one is set", () => {
    const state = createChessGame([WHITE, BLACK]).state;
    expect(chessJevState(state, "  Play the London.  ").strategyOverride).toBe(
      "Play the London.",
    );
    expect(chessJevState(state, "   ")).not.toHaveProperty("strategyOverride");
  });
});

describe("the chess definition", () => {
  it("judges with Jev through the shared evaluate step", () => {
    expect(chessGame.evaluate).toBe(chessEvaluate);
  });
});
