import { describe, it, expect } from "bun:test";
import {
  formatLegalActions,
  replyFormatInstruction,
  choiceSchema,
  choiceToAction,
  repairModelReply,
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

  it("rejects string choices and missing reasoning (repair handles those)", () => {
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

describe("repairModelReply", () => {
  it("passes through an already-valid reply", async () => {
    const repaired = await repairModelReply({
      text: '{"reasoning": "why", "choice": 2}',
    });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "why", choice: 2 });
  });

  it("extracts JSON from markdown code fences", async () => {
    const repaired = await repairModelReply({
      text: 'Here is my move:\n```json\n{"reasoning": "x", "choice": 2}\n```',
    });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "x", choice: 2 });
  });

  it("extracts JSON embedded in prose", async () => {
    const repaired = await repairModelReply({
      text: 'I will buy Silver. {"reasoning": "x", "choice": 2} That is best.',
    });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "x", choice: 2 });
  });

  it("unwraps the answer-wrapper pattern", async () => {
    const repaired = await repairModelReply({
      text: '{"answer": "{\\"reasoning\\": \\"x\\", \\"choice\\": 2}"}',
    });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "x", choice: 2 });
  });

  it("unwraps a single-key wrapper holding stringified JSON", async () => {
    const repaired = await repairModelReply({
      text: '{"output": "{\\"reasoning\\": \\"x\\", \\"choice\\": 3}"}',
    });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "x", choice: 3 });
  });

  it("coerces a numeric-string choice to a number", async () => {
    const repaired = await repairModelReply({
      text: '{"reasoning": "x", "choice": "2"}',
    });

    expect(JSON.parse(repaired!).choice).toBe(2);
  });

  it("fills missing reasoning with an empty string", async () => {
    const repaired = await repairModelReply({ text: '{"choice": 1}' });

    expect(JSON.parse(repaired!)).toEqual({ reasoning: "", choice: 1 });
  });

  it("stringifies object reasoning", async () => {
    const repaired = await repairModelReply({
      text: '{"reasoning": {"why": "economy"}, "choice": 2}',
    });

    expect(JSON.parse(repaired!).reasoning).toBe('{"why":"economy"}');
  });

  it("leaves a non-numeric choice for schema validation to reject", async () => {
    const repaired = await repairModelReply({
      text: '{"reasoning": "x", "choice": "abc"}',
    });

    expect(JSON.parse(repaired!).choice).toBe("abc");
  });

  it("returns null when there is no JSON at all", async () => {
    expect(await repairModelReply({ text: "I would buy Silver." })).toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    expect(await repairModelReply({ text: '{"choice": 2' })).toBeNull();
  });

  it("returns null for non-object JSON", async () => {
    expect(await repairModelReply({ text: '["choice", 2]' })).toBeNull();
  });
});
