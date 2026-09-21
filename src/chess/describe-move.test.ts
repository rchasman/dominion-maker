import { describe, expect, it } from "bun:test";
import { describeMove, eventText } from "./describe-move";
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
      piece: "Knight",
      to: "f3",
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

  it("reads castling as a king move with a castle event", () => {
    const castled = lastOf(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
    expect(castled.piece).toBe("King");
    expect(castled.to).toBe("g1");
    expect(castled.events).toEqual([{ kind: "castle", side: "kingside" }]);
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

describe("eventText", () => {
  it("reads each event as a short phrase", () => {
    expect(eventText({ kind: "capture", piece: "Rook" })).toBe("Takes Rook");
    expect(eventText({ kind: "en-passant" })).toBe("En passant");
    expect(eventText({ kind: "castle", side: "queenside" })).toBe(
      "Castles queenside",
    );
    expect(eventText({ kind: "promotion", piece: "Knight" })).toBe(
      "Promotes to Knight",
    );
    expect(eventText({ kind: "check" })).toBe("Check");
    expect(eventText({ kind: "checkmate" })).toBe("Checkmate");
  });
});

describe("replayMoves", () => {
  it("returns null for a log no engine produced", () => {
    expect(replayMoves(["zzz"])).toBeNull();
  });
});
