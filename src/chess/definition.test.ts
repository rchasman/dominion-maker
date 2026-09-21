import { describe, expect, it } from "bun:test";
import { chessGame } from "./definition";
import { createChessGame, type ChessEngine } from "./engine";
import { replyFormatInstruction } from "../core/consensus/numbered-choice";
import type { ChessMove, ChessState } from "./shape";
import { chessStateAfter, playChessMoves } from "./test-helpers";

const WHITE = "white";
const BLACK = "black";
const FACT_HEADER =
  "{choice\tsan\tpiece\tfrom\tto\ttakes\teffect\tattackers\tdefenders\tcheapestAttacker\topponentBestCapture}:";

const play = (engine: ChessEngine, sans: string[]) =>
  playChessMoves(engine, [WHITE, BLACK], sans);

const after = (sans: string[]): ChessState =>
  chessStateAfter([WHITE, BLACK], sans);

const promptFor = (state: ChessState, customStrategy = "") => {
  const player = chessGame.whoMustAct(state) ?? WHITE;
  return chessGame.prompt({
    state,
    player,
    moves: chessGame.legalMoves(state, player),
    playerStrategies: {},
    customStrategy,
  });
};

const sanOf = (moves: ChessMove[], san: string): ChessMove | undefined =>
  moves.find(move => move.san === san);

describe("the chess definition answers what the driver asks", () => {
  it("offers the twenty opening moves, each with its squares", () => {
    const moves = chessGame.legalMoves(
      createChessGame([WHITE, BLACK]).state,
      WHITE,
    );
    expect(moves).toHaveLength(20);
    expect(
      moves.every(
        move => /^[a-h][1-8]$/.test(move.from) && /^[a-h][1-8]$/.test(move.to),
      ),
    ).toBe(true);
    expect(moves).toContainEqual({ san: "e4", from: "e2", to: "e4" });
  });

  it("carries a promotion on the move and nothing else beyond its squares", () => {
    const moves = chessGame.legalMoves(
      {
        ...after([]),
        fen: "8/P7/8/8/8/8/8/k6K w - - 0 1",
      },
      WHITE,
    );
    expect(sanOf(moves, "a8=Q+")).toEqual({
      san: "a8=Q+",
      from: "a7",
      to: "a8",
      promotion: "q",
    });
    expect(
      sanOf(chessGame.legalMoves(after(["e4", "d5"]), WHITE), "exd5"),
    ).toEqual({
      san: "exd5",
      from: "e4",
      to: "d5",
    });
  });

  it("hands the turn over and stops once the game is over", () => {
    const engine = createChessGame([WHITE, BLACK]);
    expect(chessGame.players(engine.state)).toEqual([WHITE, BLACK]);
    expect(chessGame.whoMustAct(engine.state)).toBe(WHITE);
    play(engine, ["e4"]);
    expect(chessGame.whoMustAct(engine.state)).toBe(BLACK);
    engine.dispatch({ type: "RESIGN", playerId: BLACK });
    expect(chessGame.whoMustAct(engine.state)).toBeNull();
    expect(chessGame.legalMoves(engine.state, WHITE)).toEqual([]);
  });

  it("turns a picked move into the command the engine takes", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const move = sanOf(chessGame.legalMoves(engine.state, WHITE), "e4");
    expect(move).toEqual({ san: "e4", from: "e2", to: "e4" });
    expect(move && chessGame.moveToCommand(engine.state, move, WHITE)).toEqual({
      type: "MOVE",
      playerId: WHITE,
      san: "e4",
    });
  });

  it("carries a model's reasoning on a move and keys the vote by its SAN", () => {
    const picked: ChessMove = { san: "e4", from: "e2", to: "e4" };
    const move = chessGame.withReasoning(picked, "centre");
    expect(chessGame.reasoningOf(move)).toBe("centre");
    expect(chessGame.moveKey(move)).toBe("e4");
  });

  it("labels a vote with the SAN and what chess.js proves the move does", () => {
    expect(
      chessGame.describeMove(after([]), { san: "e4", from: "e2", to: "e4" }),
    ).toBe("e4; attacked 0 / defended 0");
    const knights = after(["e4", "e5", "Nf3", "Nc6"]);
    expect(
      chessGame.describeMove(knights, {
        san: "Nxe5",
        from: "f3",
        to: "e5",
        reasoning: "wins a pawn",
      }),
    ).toBe(
      "Nxe5 takes Pawn 1; attacked 1 (Knight 3) / defended 0; reply takes Knight 3 on e5",
    );
    expect(
      chessGame.describeMove(knights, { san: "Ng5", from: "f3", to: "g5" }),
    ).toBe(
      "Ng5; attacked 1 (Queen 9) / defended 0; reply takes Knight 3 on g5",
    );
  });

  it("refuses to label a move the position does not allow", () => {
    expect(() =>
      chessGame.describeMove(after([]), { san: "Qh5", from: "d1", to: "h5" }),
    ).toThrow("Qh5 is not legal");
  });

  it("teaches the reply format, the value scale and the fact columns in the system text", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const { system } = promptFor(engine.state);
    expect(system).toContain("chess");
    expect(system).toContain(replyFormatInstruction(20));
    expect(system).toContain('{"reasoning"');
    expect(system).toContain(
      "Piece values in pawns: queen 9, rook 5, bishop 3, knight 3, pawn 1",
    );
    expect(system).toContain("cheapestAttacker");
    expect(system).toContain("opponentBestCapture");
    expect(system).toContain(
      "GUIDANCE (read the fact columns, not the picture)",
    );
    expect(system).toContain(
      "With defenders 0, a capture on that square cannot be answered by a recapture",
    );
    expect(system).toContain("a pinned piece is not one");
    expect(system).toContain("RECENT MOVES were already played");
    expect(system).toContain("A piece absent from PIECES is off the board");
    expect(system).not.toContain("Develop your minor pieces");
    expect(system).not.toContain("castle early");
  });

  it("shows the board, the FEN and a numbered table with a fact column per move", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const { user } = promptFor(engine.state);
    expect(user).toContain(engine.state.fen);
    expect(user).toContain("+------------------------+");
    expect(user).toContain("8 | r  n  b  q  k  b  n  r |");
    expect(user).toContain(
      "LEGAL MOVES (choose exactly one by number; the columns are facts the rules prove)",
    );
    expect(user).toContain(`[20\t]${FACT_HEADER}`);
    // a3 leaves the pawn guarded by the rook, the b2 pawn and the knight
    expect(user).toContain(
      "\n  1\ta3\tPawn\ta2\ta3\tnone\tnone\t0\t3\tnone\tnone\n",
    );
  });

  it("puts the capture, the attackers, the cheapest attacker and the best reply in the row", () => {
    const { user } = promptFor(after(["e4", "e5", "Nf3", "Nc6"]));
    expect(user).toMatch(
      /\n +\d+\tNxe5\tKnight\tf3\te5\tPawn 1\tnone\t1\t0\tKnight 3\tKnight 3 on e5\n/,
    );
    expect(user).toMatch(
      /\n +\d+\tNg5\tKnight\tf3\tg5\tnone\tnone\t1\t0\tQueen 9\tKnight 3 on g5\n/,
    );
    expect(user).toMatch(
      /\n +\d+\tNd4\tKnight\tf3\td4\tnone\tnone\t2\t0\tPawn 1\tKnight 3 on d4\n/,
    );
  });

  it("names castling, promotion, en passant, check and checkmate in the effect column", () => {
    const castling = promptFor({
      ...after([]),
      fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    });
    expect(castling.user).toMatch(
      /\n +\d+\tO-O\tKing\te1\tg1\tnone\tcastles kingside\t0\t1\tnone\tRook 5 on a1\n/,
    );
    const promotion = promptFor({
      ...after([]),
      fen: "8/P7/8/8/8/8/8/k6K w - - 0 1",
    });
    expect(promotion.user).toMatch(
      /\n +\d+\ta8=Q\+\tPawn\ta7\ta8\tnone\tpromotes to Queen, check\t0\t0\tnone\tnone\n/,
    );
    const enPassant = promptFor({
      ...after([]),
      fen: "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
    });
    expect(enPassant.user).toMatch(
      /\n +\d+\texf6\tPawn\te5\tf6\tPawn 1\ten passant\t3\t0\tPawn 1\tPawn 1 on f6\n/,
    );
    const mate = promptFor({
      ...after([]),
      fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    });
    expect(mate.user).toMatch(
      /\n +\d+\tRa8#\tRook\ta1\ta8\tnone\tcheckmate\t0\t0\tnone\tnone\n/,
    );
  });

  it("states the material, the castling rights, the pieces at risk and the threat before the table", () => {
    const opening = promptFor(after([]));
    expect(opening.user).toContain(
      "MATERIAL: White 39, Black 39. Material is level.",
    );
    expect(opening.user).toContain(
      "CASTLING RIGHTS: White kingside and queenside; Black kingside and queenside.",
    );
    expect(opening.user).toContain(
      "YOUR PIECES ATTACKED AND UNDEFENDED: none.",
    );
    expect(opening.user).toContain(
      "OPPONENT'S BEST CAPTURE IF YOU DO NOTHING: none.",
    );
    expect(opening.user.indexOf("MATERIAL:")).toBeLessThan(
      opening.user.indexOf("LEGAL MOVES"),
    );
    // 1.e4 e5 2.Nf3 d5 3.exd5 Qxd5 4.Nc3: Black's queen stands attacked and unguarded
    const threatened = promptFor(
      after(["e4", "e5", "Nf3", "d5", "exd5", "Qxd5", "Nc3"]),
    );
    expect(threatened.user).toContain(
      "MATERIAL: White 38, Black 38. Material is level.",
    );
    expect(threatened.user).toContain(
      "YOUR PIECES ATTACKED AND UNDEFENDED: Queen 9 on d5 (attacked by 1, cheapest Knight 3).",
    );
    expect(threatened.user).toContain(
      "OPPONENT'S BEST CAPTURE IF YOU DO NOTHING: Queen 9 on d5.",
    );
  });

  it("lists every piece by square and marks the recent moves as history", () => {
    // 1.d4 d5 2.c4 dxc4 3.Qa4+ Qd7 4.Qxd7+ Nxd7 5.Nc3: the queens are gone, though the recent moves still name them
    const { user } = promptFor(
      after(["d4", "d5", "c4", "dxc4", "Qa4+", "Qd7", "Qxd7+", "Nxd7", "Nc3"]),
    );
    expect(user).toContain(
      "PIECES (every piece on the board by square; K king, Q queen, R rook, B bishop, N knight, P pawn):\nWhite: K e1, R a1 h1, B c1 f1, N c3 g1, P a2 b2 d4 e2 f2 g2 h2\nBlack: K e8, R a8 h8, B c8 f8, N d7 g8, P a7 b7 c4 c7 e7 f7 g7 h7",
    );
    expect(user).toContain(
      "RECENT MOVES (already played, not the position): d5 c4 dxc4 Qa4+ Qd7 Qxd7+ Nxd7 Nc3",
    );
    expect(user.indexOf("PIECES (")).toBeLessThan(user.indexOf("RECENT MOVES"));
  });

  it("names the check in place of a threat while the king is in check", () => {
    const { user } = promptFor({
      ...after([]),
      fen: "4k3/8/8/8/8/8/8/r3K3 w - - 0 1",
      inCheck: true,
    });
    expect(user).toContain("It is your move. You are in check.");
    expect(user).toContain(
      "OPPONENT'S BEST CAPTURE IF YOU DO NOTHING: you are in check and must answer it first.",
    );
  });

  it("recalls only the last eight moves", () => {
    const engine = createChessGame([WHITE, BLACK]);
    play(engine, ["a3", "a6", "b3", "b6", "c3", "c6", "d3", "d6", "e3", "e6"]);
    const { user } = promptFor(engine.state);
    expect(user).toContain("b3 b6 c3 c6 d3 d6 e3 e6");
    expect(user).not.toContain("a3 a6");
  });

  it("adds a custom strategy only when there is one", () => {
    const engine = createChessGame([WHITE, BLACK]);
    expect(promptFor(engine.state).user).not.toContain("STRATEGY");
    expect(promptFor(engine.state, "  Play the London.  ").user).toContain(
      "Play the London.",
    );
  });

  it("describes the position for the consensus viewer", () => {
    const engine = createChessGame([WHITE, BLACK]);
    play(engine, ["e4", "e5", "Nf3"]);
    const legal = chessGame.legalMoves(engine.state, BLACK);
    const context = chessGame.logContext(engine.state, BLACK, legal);
    expect(context.turnId).toBe(`${BLACK}-3`);
    expect(context.isChoice).toBe(false);
    expect(context.payload).toEqual({
      turn: 2,
      phase: "move",
      activePlayerId: BLACK,
      fen: engine.state.fen,
      moves: ["e4", "e5", "Nf3"],
      lastMove: "Nf3",
    });
  });

  it("names the turn and the phase the consensus action id is built from", () => {
    // `t${turn}-${phase}-...` reads "tundefined-undefined" without these two.
    const engine = createChessGame([WHITE, BLACK]);
    const { payload } = chessGame.logContext(
      engine.state,
      WHITE,
      chessGame.legalMoves(engine.state, WHITE),
    );
    expect(typeof payload["turn"]).toBe("number");
    expect(payload["turn"]).toBe(1);
    expect(payload["phase"]).toBe("move");
  });
});
