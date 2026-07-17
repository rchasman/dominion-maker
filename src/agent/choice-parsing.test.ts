import { describe, it, expect } from "bun:test";
import {
  formatLegalActions,
  replyFormatInstruction,
  choiceSchema,
  choiceToAction,
} from "./choice-parsing";
import type { Action } from "../types/action";

const LEGAL: Action[] = [
  { type: "play_treasure", card: "Copper" },
  { type: "buy_card", card: "Silver" },
  { type: "end_phase" },
];

describe("formatLegalActions", () => {
  it("numbers actions 1-based with type and card columns", () => {
    const table = formatLegalActions(LEGAL);

    expect(table).toContain("choice\ttype\tcard");
    expect(table).toContain("1\tplay_treasure\tCopper");
    expect(table).toContain("2\tbuy_card\tSilver");
    expect(table).toContain("3\tend_phase");
  });
});

describe("replyFormatInstruction", () => {
  it("states the reply shape and the valid choice range", () => {
    const instruction = replyFormatInstruction(3);

    expect(instruction).toContain('"reasoning"');
    expect(instruction).toContain('"choice"');
    expect(instruction).toContain("1-3");
  });
});

describe("choiceSchema", () => {
  const schema = choiceSchema(3);

  it("accepts a valid reply", () => {
    const result = schema.safeParse({ reasoning: "why", choice: 2 });

    expect(result.success).toBe(true);
  });

  it("rejects out-of-range, zero, and non-integer choices", () => {
    expect(schema.safeParse({ reasoning: "x", choice: 4 }).success).toBe(false);
    expect(schema.safeParse({ reasoning: "x", choice: 0 }).success).toBe(false);
    expect(schema.safeParse({ reasoning: "x", choice: 1.5 }).success).toBe(
      false,
    );
  });

  it("rejects string choices and missing reasoning (corrective retry handles those)", () => {
    expect(schema.safeParse({ reasoning: "x", choice: "2" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ choice: 2 }).success).toBe(false);
  });
});

describe("choiceToAction", () => {
  it("maps the choice number to the legal action with reasoning attached", () => {
    const action = choiceToAction({ reasoning: "econ", choice: 2 }, LEGAL);

    expect(action.type).toBe("buy_card");
    expect(action).toHaveProperty("card", "Silver");
    expect(action.reasoning).toBe("econ");
  });

  it("throws on an out-of-range choice", () => {
    expect(() => choiceToAction({ reasoning: "x", choice: 7 }, LEGAL)).toThrow(
      "out of range",
    );
  });
});
