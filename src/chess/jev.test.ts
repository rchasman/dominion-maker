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

  it("names the piece, its squares and the square it lands on, one move ahead", () => {
    const question = questionFor(createChessGame([WHITE, BLACK]).state);
    expect(descriptionOf(question, "e4")).toBe(
      "Pawn from e2 to e4. After it e4 is attacked by 0 enemy pieces and guarded by 0 own pieces. The opponent has no capture in reply",
    );
    expect(descriptionOf(question, "Nf3")).toBe(
      "Knight from g1 to f3. After it f3 is attacked by 0 enemy pieces and guarded by 2 own pieces. The opponent has no capture in reply",
    );
  });

  it("states what a capture takes and what the opponent takes back", () => {
    const question = questionFor(played(["e4", "d5"]));
    expect(descriptionOf(question, "exd5")).toBe(
      "Pawn from e4 to d5: takes Pawn 1. After it d5 is attacked by 1 enemy piece (cheapest: Queen 9) and guarded by 0 own pieces. The opponent's best reply takes your Pawn 1 on d5",
    );
  });

  it("states a hanging piece as its attackers and guards, not as a verdict", () => {
    const question = questionFor(played(["e4", "e5", "Nf3", "Nc6"]));
    expect(descriptionOf(question, "Ng5")).toBe(
      "Knight from f3 to g5. After it g5 is attacked by 1 enemy piece (cheapest: Queen 9) and guarded by 0 own pieces. The opponent's best reply takes your Knight 3 on g5",
    );
    expect(descriptionOf(question, "Nd4")).toBe(
      "Knight from f3 to d4. After it d4 is attacked by 2 enemy pieces (cheapest: Pawn 1) and guarded by 0 own pieces. The opponent's best reply takes your Knight 3 on d4",
    );
  });

  it("states castling, check, checkmate, promotion and en passant", () => {
    expect(
      descriptionOf(
        questionFor(positioned("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")),
        "O-O",
      ),
    ).toBe(
      "King from e1 to g1: castles kingside. After it g1 is attacked by 0 enemy pieces and guarded by 1 own piece. The opponent's best reply takes your Rook 5 on a1",
    );
    expect(
      descriptionOf(
        questionFor(positioned("4k3/8/8/8/8/8/8/4K2R w K - 0 1")),
        "Rh8+",
      ),
    ).toBe(
      "Rook from h1 to h8: check. After it h8 is attacked by 0 enemy pieces and guarded by 0 own pieces. The opponent has no capture in reply",
    );
    expect(
      descriptionOf(
        questionFor(positioned("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")),
        "Ra8#",
      ),
    ).toBe("Rook from a1 to a8: checkmate. The game ends won");
    expect(
      descriptionOf(
        questionFor(positioned("8/P7/8/8/8/8/8/k6K w - - 0 1")),
        "a8=Q+",
      ),
    ).toBe(
      "Pawn from a7 to a8: promotes to Queen, check. After it a8 is attacked by 0 enemy pieces and guarded by 0 own pieces. The opponent has no capture in reply",
    );
    expect(
      descriptionOf(
        questionFor(
          positioned(
            "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
          ),
        ),
        "exf6",
      ),
    ).toBe(
      "Pawn from e5 to f6: takes Pawn 1, en passant. After it f6 is attacked by 3 enemy pieces (cheapest: Pawn 1) and guarded by 0 own pieces. The opponent's best reply takes your Pawn 1 on f6",
    );
  });

  it("tells the mover its colour, the value scale and whether it is in check", () => {
    const quiet = questionFor(createChessGame([WHITE, BLACK]).state);
    expect(quiet.instructions).toContain("You are White and it is your move.");
    expect(quiet.instructions).toContain(
      "Piece values in pawns: queen 9, rook 5, bishop 3, knight 3, pawn 1.",
    );
    expect(quiet.instructions).toContain(
      "who attacks and guards the square it lands on",
    );
    expect(quiet.instructions).not.toContain("in check");
    expect(quiet.instructions).not.toContain("develop");
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
  it("spells the opening position out as an 8x8 matrix, named pieces and position facts", () => {
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
    expect(jevState.pieces).toEqual({
      white: {
        King: ["e1"],
        Queen: ["d1"],
        Rook: ["a1", "h1"],
        Bishop: ["c1", "f1"],
        Knight: ["b1", "g1"],
        Pawn: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
      },
      black: {
        King: ["e8"],
        Queen: ["d8"],
        Rook: ["a8", "h8"],
        Bishop: ["c8", "f8"],
        Knight: ["b8", "g8"],
        Pawn: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"],
      },
    });
    expect(jevState.material).toEqual({
      white: 39,
      black: 39,
      summary: "Material is level.",
    });
    expect(jevState.castlingRights).toEqual({
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(jevState.yourPiecesAttackedAndUndefended).toEqual([]);
    expect(jevState.opponentBestCaptureIfYouDoNothing).toBeNull();
    expect(jevState).not.toHaveProperty("recentMovesAlreadyPlayed");
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
    expect(jevState.recentMovesAlreadyPlayed).toEqual(["e4", "d5", "exd5"]);
    expect(jevState.moveNumber).toBe(2);
  });

  it("names the mover's pieces that hang right now and the opponent's best capture", () => {
    // 1.e4 e5 2.Nf3 d5 3.exd5 Qxd5 4.Nc3: the queen stands attacked with nothing guarding d5
    const jevState = chessJevState(
      played(["e4", "e5", "Nf3", "d5", "exd5", "Qxd5", "Nc3"]),
      "",
    );
    expect(jevState.yourPiecesAttackedAndUndefended).toEqual([
      {
        piece: "Queen",
        value: 9,
        square: "d5",
        attackers: 1,
        cheapestAttacker: "Knight 3",
      },
    ]);
    expect(jevState.opponentBestCaptureIfYouDoNothing).toEqual({
      piece: "Queen",
      value: 9,
      square: "d5",
    });
  });

  it("lists only the pieces still on the board once a queen has been captured", () => {
    // 1.d4 d5 2.c4 dxc4 3.Qa4+ Qd7 4.Qxd7+ Nxd7 5.Nc3: the queens are gone, and the recent moves still name them
    const jevState = chessJevState(
      played(["d4", "d5", "c4", "dxc4", "Qa4+", "Qd7", "Qxd7+", "Nxd7", "Nc3"]),
      "",
    );
    expect(jevState.pieces).toEqual({
      white: {
        King: ["e1"],
        Rook: ["a1", "h1"],
        Bishop: ["c1", "f1"],
        Knight: ["c3", "g1"],
        Pawn: ["a2", "b2", "d4", "e2", "f2", "g2", "h2"],
      },
      black: {
        King: ["e8"],
        Rook: ["a8", "h8"],
        Bishop: ["c8", "f8"],
        Knight: ["d7", "g8"],
        Pawn: ["a7", "b7", "c4", "c7", "e7", "f7", "g7", "h7"],
      },
    });
    expect(jevState.recentMovesAlreadyPlayed).toEqual([
      "d5",
      "c4",
      "dxc4",
      "Qa4+",
      "Qd7",
      "Qxd7+",
      "Nxd7",
      "Nc3",
    ]);
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
