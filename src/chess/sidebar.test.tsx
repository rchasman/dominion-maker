import { describe, expect, it } from "bun:test";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import { chessTurnStatus } from "./sidebar";

const opening = createChessGame([...CHESS_PLAYERS]).state;

const afterE4 = () => {
  const engine = createChessGame([...CHESS_PLAYERS]);
  const played = engine.dispatch({ type: "MOVE", playerId: "w", san: "e4" });
  if (!played.ok) throw new Error(played.error);
  return engine.state;
};

describe("chessTurnStatus", () => {
  it("names the local human's own turn", () => {
    expect(
      chessTurnStatus(
        opening,
        { w: HUMAN_SEAT, b: HEURISTIC_SEAT },
        "w",
        false,
      ),
    ).toBe("yours");
  });

  it("says nothing while the turn is still being processed", () => {
    expect(
      chessTurnStatus(opening, { w: HUMAN_SEAT, b: HEURISTIC_SEAT }, "w", true),
    ).toBeNull();
  });

  it("reads a bot on the clock as thinking", () => {
    const state = afterE4();
    expect(
      chessTurnStatus(state, { w: HUMAN_SEAT, b: HEURISTIC_SEAT }, "w", false),
    ).toBe("thinking");
    expect(
      chessTurnStatus(
        state,
        { w: HUMAN_SEAT, b: DEFAULT_LLM_SEAT },
        "w",
        false,
      ),
    ).toBe("thinking");
  });

  it("says nothing while a remote human is to move", () => {
    expect(
      chessTurnStatus(opening, { w: HUMAN_SEAT, b: HUMAN_SEAT }, "b", false),
    ).toBeNull();
  });

  it("says nothing once the game is over", () => {
    const resigned = createChessGame([...CHESS_PLAYERS]);
    const out = resigned.dispatch({ type: "RESIGN", playerId: "w" });
    if (!out.ok) throw new Error(out.error);
    expect(
      chessTurnStatus(
        resigned.state,
        { w: HUMAN_SEAT, b: HEURISTIC_SEAT },
        "w",
        false,
      ),
    ).toBeNull();
  });
});
