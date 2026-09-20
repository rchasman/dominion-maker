import { describe, expect, it } from "bun:test";
import { chessHeuristic } from "./heuristic";
import { createChessGame, type ChessEngine } from "./engine";
import type { ChessState } from "./shape";

const WHITE = "white";
const BLACK = "black";

const play = (engine: ChessEngine, sans: string[]) =>
  sans.map((san, index) =>
    engine.dispatch({
      type: "MOVE",
      playerId: index % 2 === 0 ? WHITE : BLACK,
      san,
    }),
  );

const after = (sans: string[]): ChessState => {
  const engine = createChessGame([WHITE, BLACK]);
  play(engine, sans);
  return engine.state;
};

const sanChosen = (state: ChessState, player: string): string => {
  const command = chessHeuristic(state, player);
  return command.type === "MOVE" ? command.san : command.type;
};

describe("the chess heuristic plays the obvious move", () => {
  it("takes mate in one when it is there", () => {
    // Fool's mate: after 1.f3 e5 2.g4 black mates with Qh4#.
    expect(sanChosen(after(["f3", "e5", "g4"]), BLACK)).toBe("Qh4#");
  });

  it("prefers the queen capture over the pawn capture", () => {
    const state = after(["d4", "Nc6", "d5", "e5", "dxe6", "dxe6", "e4", "f5"]);
    expect(sanChosen(state, WHITE)).toBe("Qxd8+");
  });

  it("leaves the biggest capture when only a pawn guards the square", () => {
    // White may take a rook on h6, but g7 recaptures; exf5 is the safe take.
    const state = after([
      "g4",
      "b6",
      "h3",
      "b5",
      "f3",
      "f6",
      "a3",
      "h5",
      "e4",
      "f5",
      "Be2",
      "Rh6",
      "Ra2",
      "Nf6",
      "d3",
      "a5",
    ]);
    expect(sanChosen(state, WHITE)).toBe("exf5");
  });

  it("gives the same quiet move for the same position twice", () => {
    const first = sanChosen(after([]), WHITE);
    expect(sanChosen(after([]), WHITE)).toBe(first);
    expect(sanChosen(after([]), WHITE)).toBe(first);
  });

  it("does not answer every position with the same quiet move", () => {
    const chosen = [
      after([]),
      after(["e4", "e5"]),
      after(["d4", "d5"]),
      after(["c4", "c5"]),
    ].map(state => sanChosen(state, WHITE));
    expect(new Set(chosen).size).toBeGreaterThan(1);
  });

  it("refuses to move once the game is over", () => {
    const engine = createChessGame([WHITE, BLACK]);
    engine.dispatch({ type: "RESIGN", playerId: BLACK });
    expect(() => chessHeuristic(engine.state, WHITE)).toThrow(
      "Chess heuristic was asked for a move after the game ended",
    );
  });

  it("refuses to move for the side that is not to move", () => {
    expect(() => chessHeuristic(after([]), BLACK)).toThrow(
      "it is white to move",
    );
  });
});
