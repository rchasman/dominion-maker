import { describe, expect, it } from "bun:test";
import { describeMove, eventPhrase } from "./describe-move";
import { replayMoves } from "./replay";

const lastOf = (moves: string[]) => {
  const replayed = replayMoves(moves);
  if (replayed === null) throw new Error("line does not replay");
  const last = replayed.at(-1);
  if (last === undefined) throw new Error("empty line");
  return describeMove(last);
};

describe("describeMove", () => {
  it("names the piece and the square it lands on", () => {
    expect(lastOf(["Nf3"])).toEqual({
      san: "Nf3",
      action: { kind: "move", piece: "Knight", to: "f3" },
      events: [],
    });
  });

  it("lists a capture with the piece taken", () => {
    expect(lastOf(["e4", "d5", "exd5"]).events).toEqual([
      { kind: "capture", piece: "Pawn" },
    ]);
  });

  it("lists en passant beside its capture", () => {
    expect(lastOf(["e4", "a6", "e5", "d5", "exd6"]).events).toEqual([
      { kind: "capture", piece: "Pawn" },
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
      { kind: "capture", piece: "Queen" },
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
    expect(eventPhrase({ kind: "capture", piece: "Rook" })).toEqual({
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
