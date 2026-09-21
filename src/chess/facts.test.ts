import { describe, expect, it } from "bun:test";
import { Chess } from "chess.js";
import {
  castlingText,
  describeMove,
  eventPhrase,
  hangsMovedPiece,
  landsOnCheaperAttacker,
  legalMoveFacts,
  legalMoveLabel,
  moveFacts,
  PIECE_VALUES_TEXT,
  pieceAtRiskText,
  pieceGroupsText,
  positionFacts,
  worthText,
  type MoveFacts,
} from "./facts";
import { replayMoves } from "./replay";

const fenAfter = (sans: string[]): string => {
  const board = new Chess();
  sans.map(san => board.move(san));
  return board.fen();
};

const lastOf = (moves: string[]) => {
  const replayed = replayMoves(moves);
  if (replayed === null) throw new Error("line does not replay");
  const last = replayed.at(-1);
  if (last === undefined) throw new Error("empty line");
  return describeMove(last);
};

const factsOf = (fen: string, san: string): MoveFacts => {
  const [offered] = legalMoveFacts(fen, [{ san, from: "", to: "" }]);
  if (offered === undefined) throw new Error(`${san} was not judged`);
  return offered.facts;
};

const labelOf = (fen: string, san: string): string =>
  legalMoveLabel(fen, { san, from: "", to: "" });

const AFTER_KNIGHTS = ["e4", "e5", "Nf3", "Nc6"];
const EN_PASSANT_FEN =
  "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3";
const CASTLING_FEN = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
const PROMOTION_FEN = "8/P7/8/8/8/8/8/k6K w - - 0 1";
const MATE_FEN = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
/** White queen on d1 may land on d4, where the e5 pawn attacks it and the c3 pawn guards it */
const QUEEN_TO_D4_FEN = "4k3/8/8/4p3/8/2P5/8/3QK3 w - - 0 1";
/** After d2-d4 the e4 pawn can take it en passant, the only capture on the board */
const EN_PASSANT_REPLY_FEN = "4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1";
/** The e7 rook is pinned to its king by the e2 rook, so it may not leave the e-file to take on b7 */
const PINNED_ATTACKER_FEN = "4k3/4r3/8/2N5/8/8/4R3/4K3 w - - 0 1";
/** The knight already stands on b7 where only the pinned rook reaches it */
const PINNED_ATTACKER_POSITION_FEN = "4k3/1N2r3/8/8/8/8/4R3/4K3 w - - 0 1";
/** The e2 knight guards d4 but is pinned to its king by the e8 rook, so it may not take back there */
const PINNED_DEFENDER_FEN = "k3r3/8/8/2p5/8/8/1B2N3/4K3 w - - 0 1";
/** bxa8=Q takes the rook, then the c6 bishop takes the new queen */
const PROMOTION_CAPTURE_FEN = "r7/1P6/2b5/8/8/8/8/k5K1 w - - 0 1";

describe("describeMove", () => {
  it("names the piece and the square it lands on", () => {
    expect(lastOf(["Nf3"])).toEqual({
      san: "Nf3",
      action: { kind: "move", piece: "Knight", to: "f3" },
      events: [],
    });
  });

  it("lists a capture with the piece taken and its worth", () => {
    expect(lastOf(["e4", "d5", "exd5"]).events).toEqual([
      { kind: "capture", piece: "Pawn", value: 1 },
    ]);
  });

  it("lists en passant beside its capture", () => {
    expect(lastOf(["e4", "a6", "e5", "d5", "exd6"]).events).toEqual([
      { kind: "capture", piece: "Pawn", value: 1 },
      { kind: "en-passant" },
    ]);
  });

  it("reads castling as the action itself, not a king move", () => {
    const castled = lastOf(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
    expect(castled.action).toEqual({ kind: "castle", side: "kingside" });
    expect(castled.events).toEqual([]);
  });

  it("lists a promotion with the piece chosen", () => {
    const line = ["d4", "e5", "dxe5", "d6", "exd6", "Nf6", "dxc7", "Nc6"];
    expect(lastOf([...line, "cxd8=Q+"]).events).toEqual([
      { kind: "capture", piece: "Queen", value: 9 },
      { kind: "promotion", piece: "Queen" },
      { kind: "check" },
    ]);
  });

  it("lists check and checkmate", () => {
    expect(lastOf(["e4", "f5", "Qh5+"]).events).toEqual([{ kind: "check" }]);
    expect(lastOf(["f3", "e5", "g4", "Qh4#"]).events).toEqual([
      { kind: "checkmate" },
    ]);
  });
});

describe("eventPhrase", () => {
  it("reads each event as a verb and, where one applies, a noun", () => {
    expect(eventPhrase({ kind: "capture", piece: "Rook", value: 5 })).toEqual({
      verb: "takes",
      noun: "Rook",
    });
    expect(eventPhrase({ kind: "en-passant" })).toEqual({
      verb: "en passant",
      noun: null,
    });
    expect(eventPhrase({ kind: "promotion", piece: "Knight" })).toEqual({
      verb: "promotes to",
      noun: "Knight",
    });
    expect(eventPhrase({ kind: "check" })).toEqual({
      verb: "gives check",
      noun: null,
    });
    expect(eventPhrase({ kind: "checkmate" })).toEqual({
      verb: "checkmates",
      noun: null,
    });
  });
});

describe("replayMoves", () => {
  it("returns null for a log no engine produced", () => {
    expect(replayMoves(["zzz"])).toBeNull();
  });
});

describe("moveFacts reads one move ahead", () => {
  it("counts the attackers and defenders of a hanging piece", () => {
    // The queen sees g5 down the cleared d8-h4 diagonal; nothing of White's guards it
    const facts = factsOf(fenAfter(AFTER_KNIGHTS), "Ng5");
    expect(facts).toMatchObject({
      piece: "Knight",
      from: "f3",
      to: "g5",
      attackers: 1,
      defenders: 0,
      cheapestAttacker: { piece: "Queen", value: 9 },
      opponentBestCapture: { piece: "Knight", value: 3, square: "g5" },
    });
    expect(hangsMovedPiece(facts)).toBe(true);
    expect(landsOnCheaperAttacker(facts)).toBe(false);
  });

  it("names the cheapest attacker of a square two pieces attack", () => {
    // The e5 pawn and the c6 knight both take on d4; the d2 pawn keeps the queen off it
    const facts = factsOf(fenAfter(AFTER_KNIGHTS), "Nd4");
    expect(facts).toMatchObject({
      attackers: 2,
      defenders: 0,
      cheapestAttacker: { piece: "Pawn", value: 1 },
    });
    expect(hangsMovedPiece(facts)).toBe(true);
    expect(landsOnCheaperAttacker(facts)).toBe(true);
  });

  it("does not call a knight for a pawn a hanging piece when the trade is even, but a knight for a pawn is", () => {
    // 3.d4 is guarded twice; 3.Nxe5 wins a pawn and loses the knight to Nxe5
    const pawn = factsOf(fenAfter(AFTER_KNIGHTS), "d4");
    expect(pawn).toMatchObject({
      attackers: 2,
      defenders: 2,
      cheapestAttacker: { piece: "Pawn", value: 1 },
    });
    expect(hangsMovedPiece(pawn)).toBe(false);
    expect(landsOnCheaperAttacker(pawn)).toBe(false);
    const knight = factsOf(fenAfter(AFTER_KNIGHTS), "Nxe5");
    expect(knight.events).toEqual([
      { kind: "capture", piece: "Pawn", value: 1 },
    ]);
    expect(knight).toMatchObject({
      attackers: 1,
      defenders: 0,
      cheapestAttacker: { piece: "Knight", value: 3 },
      opponentBestCapture: { piece: "Knight", value: 3, square: "e5" },
    });
    expect(hangsMovedPiece(knight)).toBe(true);
  });

  it("tells a guarded piece attacked by a cheaper piece apart from a hanging one", () => {
    const facts = factsOf(QUEEN_TO_D4_FEN, "Qd4");
    expect(facts).toMatchObject({
      attackers: 1,
      defenders: 1,
      cheapestAttacker: { piece: "Pawn", value: 1 },
      opponentBestCapture: { piece: "Queen", value: 9, square: "d4" },
    });
    expect(hangsMovedPiece(facts)).toBe(false);
    expect(landsOnCheaperAttacker(facts)).toBe(true);
  });

  it("states an en passant capture with the pawn it takes", () => {
    const facts = factsOf(EN_PASSANT_FEN, "exf6");
    expect(facts.events).toEqual([
      { kind: "capture", piece: "Pawn", value: 1 },
      { kind: "en-passant" },
    ]);
    expect(facts).toMatchObject({
      piece: "Pawn",
      from: "e5",
      to: "f6",
      attackers: 3,
      defenders: 0,
      cheapestAttacker: { piece: "Pawn", value: 1 },
      opponentBestCapture: { piece: "Pawn", value: 1, square: "f6" },
    });
    expect(hangsMovedPiece(facts)).toBe(false);
  });

  it("counts the pawn an en passant reply would take as an attacker, on the square it takes on", () => {
    const facts = factsOf(EN_PASSANT_REPLY_FEN, "d4");
    expect(facts).toMatchObject({
      attackers: 1,
      defenders: 0,
      cheapestAttacker: { piece: "Pawn", value: 1 },
      opponentBestCapture: { piece: "Pawn", value: 1, square: "d4" },
    });
    expect(hangsMovedPiece(facts)).toBe(true);
  });

  it("does not count a pinned piece as an attacker, since it has no legal capture", () => {
    const facts = factsOf(PINNED_ATTACKER_FEN, "Nb7");
    expect(facts).toMatchObject({
      attackers: 0,
      defenders: 0,
      cheapestAttacker: null,
      opponentBestCapture: { piece: "Rook", value: 5, square: "e2" },
    });
    expect(hangsMovedPiece(facts)).toBe(false);
  });

  it("does not count a defender pinned to its king, since it cannot take back", () => {
    const facts = factsOf(PINNED_DEFENDER_FEN, "Bd4");
    expect(facts).toMatchObject({
      attackers: 1,
      defenders: 0,
      cheapestAttacker: { piece: "Pawn", value: 1 },
    });
    expect(hangsMovedPiece(facts)).toBe(true);
  });

  it("judges a promoted piece at the pawn's worth", () => {
    const facts = factsOf(PROMOTION_CAPTURE_FEN, "bxa8=Q+");
    expect(facts.events).toEqual([
      { kind: "capture", piece: "Rook", value: 5 },
      { kind: "promotion", piece: "Queen" },
      { kind: "check" },
    ]);
    expect(facts).toMatchObject({
      piece: "Pawn",
      attackers: 1,
      defenders: 0,
      cheapestAttacker: { piece: "Bishop", value: 3 },
    });
    expect(hangsMovedPiece(facts)).toBe(false);
    expect(landsOnCheaperAttacker(facts)).toBe(false);
  });

  it("reads castling as the king's move with the rook now guarding it", () => {
    const facts = factsOf(CASTLING_FEN, "O-O");
    expect(facts).toMatchObject({
      action: { kind: "castle", side: "kingside" },
      piece: "King",
      from: "e1",
      to: "g1",
      attackers: 0,
      defenders: 1,
      cheapestAttacker: null,
      opponentBestCapture: { piece: "Rook", value: 5, square: "a1" },
    });
    expect(hangsMovedPiece(facts)).toBe(false);
  });

  it("states a promotion with check and no reply that captures", () => {
    const facts = factsOf(PROMOTION_FEN, "a8=Q+");
    expect(facts.events).toEqual([
      { kind: "promotion", piece: "Queen" },
      { kind: "check" },
    ]);
    expect(facts).toMatchObject({
      piece: "Pawn",
      to: "a8",
      attackers: 0,
      defenders: 0,
      opponentBestCapture: null,
    });
  });

  it("leaves the opponent no reply after checkmate", () => {
    const facts = factsOf(MATE_FEN, "Ra8#");
    expect(facts.events).toEqual([{ kind: "checkmate" }]);
    expect(facts.opponentBestCapture).toBeNull();
  });

  it("judges a move straight off a replayed record as well", () => {
    const replayed = replayMoves([...AFTER_KNIGHTS, "Ng5"]);
    const last = replayed?.at(-1);
    if (last === undefined) throw new Error("line does not replay");
    expect(moveFacts(last)).toEqual(factsOf(fenAfter(AFTER_KNIGHTS), "Ng5"));
  });

  it("refuses a move the position does not allow", () => {
    expect(() => factsOf(new Chess().fen(), "Qh5")).toThrow("Qh5 is not legal");
  });
});

describe("legalMoveLabel", () => {
  it("labels a move with what it does, who attacks and guards its square, and the best reply", () => {
    const fen = fenAfter(AFTER_KNIGHTS);
    expect(labelOf(fen, "Ng5")).toBe(
      "Ng5; attacked 1 (Queen 9) / defended 0; reply takes Knight 3 on g5",
    );
    expect(labelOf(fen, "Nxe5")).toBe(
      "Nxe5 takes Pawn 1; attacked 1 (Knight 3) / defended 0; reply takes Knight 3 on e5",
    );
    expect(labelOf(fen, "d4")).toBe(
      "d4; attacked 2 (Pawn 1) / defended 2; reply takes Pawn 1 on d4",
    );
  });

  it("labels castling, promotion and en passant by name", () => {
    expect(labelOf(CASTLING_FEN, "O-O")).toBe(
      "O-O castles kingside; attacked 0 / defended 1; reply takes Rook 5 on a1",
    );
    expect(labelOf(PROMOTION_FEN, "a8=Q+")).toBe(
      "a8=Q+ promotes to Queen, check; attacked 0 / defended 0",
    );
    expect(labelOf(EN_PASSANT_FEN, "exf6")).toBe(
      "exf6 takes Pawn 1, en passant; attacked 3 (Pawn 1) / defended 0; reply takes Pawn 1 on f6",
    );
  });

  it("stops at checkmate, which leaves nothing to read ahead", () => {
    expect(labelOf(MATE_FEN, "Ra8#")).toBe("Ra8# checkmate");
    expect(
      legalMoveLabel(MATE_FEN, { san: "Ra8#", from: "a1", to: "a8" }),
    ).toBe("Ra8# checkmate");
  });
});

describe("positionFacts", () => {
  it("reads material, castling rights, every piece and no threats off the opening", () => {
    const facts = positionFacts(new Chess().fen());
    expect(facts).toMatchObject({
      sideToMove: "w",
      inCheck: false,
      material: { white: 39, black: 39 },
      castling: {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true },
      },
      undefended: [],
      opponentBestCapture: null,
    });
    expect(facts.pieces.white).toEqual([
      { piece: "King", squares: ["e1"] },
      { piece: "Queen", squares: ["d1"] },
      { piece: "Rook", squares: ["a1", "h1"] },
      { piece: "Bishop", squares: ["c1", "f1"] },
      { piece: "Knight", squares: ["b1", "g1"] },
      {
        piece: "Pawn",
        squares: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
      },
    ]);
    expect(pieceGroupsText(facts.pieces.black)).toBe(
      "K e8, Q d8, R a8 h8, B c8 f8, N b8 g8, P a7 b7 c7 d7 e7 f7 g7 h7",
    );
  });

  it("lists only the pieces still on the board once the queens are gone", () => {
    // 1.d4 d5 2.c4 dxc4 3.Qa4+ Qd7 4.Qxd7+ Nxd7 5.Nc3: both queens have been traded off
    const facts = positionFacts(
      fenAfter([
        "d4",
        "d5",
        "c4",
        "dxc4",
        "Qa4+",
        "Qd7",
        "Qxd7+",
        "Nxd7",
        "Nc3",
      ]),
    );
    expect(pieceGroupsText(facts.pieces.white)).toBe(
      "K e1, R a1 h1, B c1 f1, N c3 g1, P a2 b2 d4 e2 f2 g2 h2",
    );
    expect(pieceGroupsText(facts.pieces.black)).toBe(
      "K e8, R a8 h8, B c8 f8, N d7 g8, P a7 b7 c4 c7 e7 f7 g7 h7",
    );
    expect(facts.pieces.black.some(group => group.piece === "Queen")).toBe(
      false,
    );
  });

  it("does not list a piece only a pinned enemy reaches, and names the capture that pin allows", () => {
    const facts = positionFacts(PINNED_ATTACKER_POSITION_FEN);
    expect(facts.undefended).toEqual([]);
    expect(facts.opponentBestCapture).toEqual({
      piece: "Rook",
      value: 5,
      square: "e2",
    });
  });

  it("lists the mover's unguarded pieces under attack and the opponent's best capture", () => {
    // 1.e4 e5 2.Nf3 d5 3.exd5 Qxd5 4.Nc3: the queen stands attacked with nothing guarding d5
    const facts = positionFacts(
      fenAfter(["e4", "e5", "Nf3", "d5", "exd5", "Qxd5", "Nc3"]),
    );
    expect(facts.sideToMove).toBe("b");
    expect(facts.material).toEqual({ white: 38, black: 38 });
    expect(facts.undefended).toEqual([
      {
        piece: "Queen",
        value: 9,
        square: "d5",
        attackers: 1,
        cheapestAttacker: { piece: "Knight", value: 3 },
      },
    ]);
    expect(facts.opponentBestCapture).toEqual({
      piece: "Queen",
      value: 9,
      square: "d5",
    });
    expect(facts.undefended.map(pieceAtRiskText)).toEqual([
      "Queen 9 on d5 (attacked by 1, cheapest Knight 3)",
    ]);
  });

  it("reads partial castling rights", () => {
    const facts = positionFacts("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1");
    expect(facts.castling).toEqual({
      white: { kingside: true, queenside: false },
      black: { kingside: false, queenside: true },
    });
    expect(castlingText(facts.castling)).toBe(
      "White kingside only; Black queenside only",
    );
  });

  it("names the check and asks nothing about the opponent's captures while in it", () => {
    const facts = positionFacts("4k3/8/8/8/8/8/8/r3K3 w - - 0 1");
    expect(facts.inCheck).toBe(true);
    expect(facts.opponentBestCapture).toBeNull();
    expect(facts.undefended).toEqual([]);
  });
});

describe("the value scale", () => {
  it("reads out the values every prompt uses", () => {
    expect(PIECE_VALUES_TEXT).toBe(
      "queen 9, rook 5, bishop 3, knight 3, pawn 1",
    );
    expect(worthText({ piece: "King", value: null })).toBe("King");
    expect(worthText({ piece: "Rook", value: 5 })).toBe("Rook 5");
  });
});
