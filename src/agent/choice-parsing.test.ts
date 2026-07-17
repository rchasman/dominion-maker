import { describe, it, expect } from "bun:test";
import {
  parseModelChoice,
  extractJson,
  formatLegalActions,
  replyFormatInstruction,
} from "./choice-parsing";
import type { Action } from "../types/action";

const LEGAL: Action[] = [
  { type: "play_treasure", card: "Copper" },
  { type: "buy_card", card: "Silver" },
  { type: "end_phase" },
];

describe("parseModelChoice", () => {
  it("maps a valid choice to the legal action with reasoning attached", () => {
    const result = parseModelChoice(
      '{"reasoning": "Silver improves the deck", "choice": 2}',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action.type).toBe("buy_card");
      expect(result.action).toHaveProperty("card", "Silver");
      expect(result.action.reasoning).toBe("Silver improves the deck");
    }
  });

  it("accepts choice as a numeric string", () => {
    const result = parseModelChoice('{"reasoning": "x", "choice": "3"}', LEGAL);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe("end_phase");
  });

  it("defaults missing reasoning to empty string", () => {
    const result = parseModelChoice('{"choice": 1}', LEGAL);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.reasoning).toBe("");
  });

  it("coerces object reasoning to a string", () => {
    const result = parseModelChoice(
      '{"reasoning": {"why": "economy"}, "choice": 2}',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.reasoning).toBe('{"why":"economy"}');
  });

  it("rejects out-of-range choice with the valid range in the error", () => {
    const result = parseModelChoice('{"reasoning": "x", "choice": 7}', LEGAL);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1 to 3");
  });

  it("rejects zero and non-integer choices", () => {
    expect(parseModelChoice('{"choice": 0}', LEGAL).ok).toBe(false);
    expect(parseModelChoice('{"choice": 1.5}', LEGAL).ok).toBe(false);
    expect(parseModelChoice('{"choice": "abc"}', LEGAL).ok).toBe(false);
  });

  it("extracts JSON from markdown code fences", () => {
    const result = parseModelChoice(
      'Here is my move:\n```json\n{"reasoning": "x", "choice": 2}\n```',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe("buy_card");
  });

  it("extracts JSON embedded in prose", () => {
    const result = parseModelChoice(
      'I will buy Silver. {"reasoning": "x", "choice": 2} That is best.',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe("buy_card");
  });

  it("unwraps the answer-wrapper pattern", () => {
    const result = parseModelChoice(
      '{"answer": "{\\"reasoning\\": \\"x\\", \\"choice\\": 2}"}',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe("buy_card");
  });

  it("unwraps a single-key wrapper holding stringified JSON", () => {
    const result = parseModelChoice(
      '{"output": "{\\"reasoning\\": \\"x\\", \\"choice\\": 3}"}',
      LEGAL,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe("end_phase");
  });

  it("rejects an action-shaped reply with a corrective error", () => {
    const result = parseModelChoice(
      '{"type": "buy_card", "card": "Silver", "reasoning": "econ"}',
      LEGAL,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("select one by its number");
  });

  it("rejects replies with no JSON at all", () => {
    const result = parseModelChoice("I would buy the Silver card.", LEGAL);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no JSON");
  });

  it("rejects malformed JSON", () => {
    const result = parseModelChoice('{"choice": 2', LEGAL);

    expect(result.ok).toBe(false);
  });
});

describe("extractJson", () => {
  it("returns trimmed text when it already starts with a brace", () => {
    expect(extractJson('  {"a": 1}  ')).toBe('{"a": 1}');
  });

  it("returns null when there is no JSON object", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

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
