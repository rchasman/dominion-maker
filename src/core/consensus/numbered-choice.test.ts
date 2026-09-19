import { describe, it, expect } from "bun:test";
import {
  choiceSchema,
  choiceToMove,
  formatNumberedMoves,
  replyFormatInstruction,
} from "./numbered-choice";

type Move = { type: string; card?: string; reasoning?: string };
const LEGAL: Move[] = [
  { type: "play_treasure", card: "Copper" },
  { type: "buy_card", card: "Silver" },
  { type: "end_phase" },
];
const row = (m: Move) => ({ type: m.type, card: m.card ?? "" });
const attach = (m: Move, reasoning: string): Move => ({ ...m, reasoning });

describe("formatNumberedMoves", () => {
  it("numbers moves 1-based with the row columns", () => {
    const table = formatNumberedMoves(LEGAL, row);
    expect(table).toContain("choice\ttype\tcard");
    expect(table).toContain("1\tplay_treasure\tCopper");
    expect(table).toContain("2\tbuy_card\tSilver");
    expect(table).toContain("3\tend_phase");
  });
});

describe("replyFormatInstruction", () => {
  it("states the reply shape and the valid range", () => {
    const instruction = replyFormatInstruction(3);
    expect(instruction).toContain('"reasoning"');
    expect(instruction).toContain('"choice"');
    expect(instruction).toContain("1-3");
  });
});

describe("choiceSchema", () => {
  const schema = choiceSchema(3);
  it("accepts a valid reply and rejects bad choices", () => {
    expect(schema.safeParse({ reasoning: "why", choice: 2 }).success).toBe(
      true,
    );
    expect(schema.safeParse({ reasoning: "x", choice: 4 }).success).toBe(false);
    expect(schema.safeParse({ reasoning: "x", choice: 0 }).success).toBe(false);
    expect(schema.safeParse({ reasoning: "x", choice: 1.5 }).success).toBe(
      false,
    );
    expect(schema.safeParse({ reasoning: "x", choice: "2" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ choice: 2 }).success).toBe(false);
  });
});

describe("choiceToMove", () => {
  it("maps the number to the legal move with reasoning attached", () => {
    expect(
      choiceToMove({ reasoning: "econ", choice: 2 }, LEGAL, attach),
    ).toEqual({ type: "buy_card", card: "Silver", reasoning: "econ" });
  });
  it("throws on an out-of-range choice", () => {
    expect(() =>
      choiceToMove({ reasoning: "x", choice: 7 }, LEGAL, attach),
    ).toThrow("out of range");
  });
});
