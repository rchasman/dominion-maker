import { describe, expect, it } from "bun:test";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { createChessGame } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import { chessTurnStatus } from "./sidebar";

const opening = createChessGame([...CHESS_PLAYERS]).state;

describe("chessTurnStatus", () => {
  it("names the local human's own turn", () => {
    expect(
      chessTurnStatus(opening, { w: HUMAN_SEAT, b: HEURISTIC_SEAT }, "w"),
    ).toBe("yours");
  });

  it("reads a bot on the clock as thinking", () => {
    const afterE4 = createChessGame([...CHESS_PLAYERS]);
    const played = afterE4.dispatch({ type: "MOVE", playerId: "w", san: "e4" });
    if (!played.ok) throw new Error(played.error);
    expect(
      chessTurnStatus(afterE4.state, { w: HUMAN_SEAT, b: HEURISTIC_SEAT }, "w"),
    ).toBe("thinking");
    expect(
      chessTurnStatus(
        afterE4.state,
        { w: HUMAN_SEAT, b: DEFAULT_LLM_SEAT },
        "w",
      ),
    ).toBe("thinking");
  });

  it("says nothing while a remote human is to move", () => {
    expect(
      chessTurnStatus(opening, { w: HUMAN_SEAT, b: HUMAN_SEAT }, "b"),
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
      ),
    ).toBeNull();
  });
});
