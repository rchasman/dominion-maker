import { describe, expect, it } from "bun:test";
import { gameStats } from "./game-stats";

describe("gameStats", () => {
  it("counts a hung knight and the capture the side never answered", () => {
    // 3.Ng5 hangs to Qxg5; 4.d4 takes nothing back
    const record = ["e4", "e5", "Nf3", "Nc6", "Ng5", "Qxg5", "d4"];
    expect(gameStats(record, "w")).toEqual({
      hung: 1,
      cheaperAttacker: 0,
      lostForFree: 1,
      captures: 0,
      checkmates: 0,
    });
    expect(gameStats(record, "b")).toEqual({
      hung: 0,
      cheaperAttacker: 0,
      lostForFree: 0,
      captures: 1,
      checkmates: 0,
    });
  });

  it("does not count the recapture that completes an even trade as a piece lost for free", () => {
    // 3.exd5 Qxd5: pawn for pawn on d5, then 4.Nc3 takes nothing back
    expect(
      gameStats(["e4", "e5", "Nf3", "d5", "exd5", "Qxd5", "Nc3"], "w"),
    ).toEqual({
      hung: 0,
      cheaperAttacker: 0,
      lostForFree: 0,
      captures: 1,
      checkmates: 0,
    });
  });

  it("counts a recapture that took back more than the side had taken", () => {
    // 3.Nxe5 wins a pawn, 3...Nxe5 takes the knight, 4.d4 takes nothing back
    expect(
      gameStats(["e4", "e5", "Nf3", "Nc6", "Nxe5", "Nxe5", "d4"], "w")
        .lostForFree,
    ).toBe(1);
  });

  it("does not judge a capture the record ends on", () => {
    expect(
      gameStats(["e4", "e5", "Nf3", "Nc6", "Ng5", "Qxg5"], "w").lostForFree,
    ).toBe(0);
  });

  it("counts a guarded piece put where a cheaper piece attacks it, once", () => {
    // 3.Bb5 stands guarded by the knight, but the c6 pawn takes it for a pawn
    expect(gameStats(["e4", "c6", "Nc3", "d5", "Bb5"], "w")).toEqual({
      hung: 0,
      cheaperAttacker: 1,
      lostForFree: 0,
      captures: 0,
      checkmates: 0,
    });
  });

  it("does not count a hung piece a second time as landing on a cheaper attacker", () => {
    // 3.Nd4 hangs to the e5 pawn, the cheapest of its two attackers
    expect(gameStats(["e4", "e5", "Nf3", "Nc6", "Nd4", "exd4"], "w")).toEqual({
      hung: 1,
      cheaperAttacker: 0,
      lostForFree: 0,
      captures: 0,
      checkmates: 0,
    });
  });

  it("counts the checkmate delivered", () => {
    expect(gameStats(["f3", "e5", "g4", "Qh4#"], "b")).toEqual({
      hung: 0,
      cheaperAttacker: 0,
      lostForFree: 0,
      captures: 0,
      checkmates: 1,
    });
  });

  it("refuses a record no engine produced", () => {
    expect(() => gameStats(["zzz"], "w")).toThrow(
      "The game record does not replay",
    );
  });
});
