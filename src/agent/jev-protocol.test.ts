import { describe, it, expect } from "bun:test";
import {
  jevOptionKey,
  jevQuestions,
  readJevChoice,
  readTypesafeConfidence,
  type JevOption,
} from "./jev-protocol";

type Move = { san: string };

const OPTIONS: JevOption<Move>[] = [
  { key: "1. e4", description: "Pawn from e2 to e4", move: { san: "e4" } },
  { key: "2. d4", description: "Pawn from d2 to d4", move: { san: "d4" } },
  { key: "3. Nf3", description: null, move: { san: "Nf3" } },
  { key: "4. h4", description: "Pawn from h2 to h4", move: { san: "h4" } },
];

describe("jevOptionKey", () => {
  it("numbers from one so the same label at two indices stays two options", () => {
    expect(jevOptionKey(0, "Copper")).toBe("1. Copper");
    expect(jevOptionKey(1, "Copper")).toBe("2. Copper");
  });
});

describe("jevQuestions", () => {
  it("puts the choice first under the action id, then the companions", () => {
    const sent = jevQuestions(
      { instructions: "Which move?", options: OPTIONS },
      {
        winning: {
          type: "boolean" as const,
          instructions: "Are you winning?",
        },
      },
    );
    expect(Object.keys(sent)).toEqual(["action", "winning"]);
    expect(sent.action).toEqual({
      type: "choice",
      instructions: "Which move?",
      criteria: {
        "1. e4": "Pawn from e2 to e4",
        "2. d4": "Pawn from d2 to d4",
        "3. Nf3": null,
        "4. h4": "Pawn from h2 to h4",
      },
    });
    expect(sent.winning.type).toBe("boolean");
  });

  it("sends only the choice when a game has no companions", () => {
    const sent = jevQuestions(
      { instructions: "Which move?", options: OPTIONS },
      {},
    );
    expect(Object.keys(sent)).toEqual(["action"]);
  });
});

describe("readJevChoice", () => {
  it("maps the chosen key back to its move and summarises the runner-up", () => {
    const read = readJevChoice(
      {
        type: "choice",
        choice: "1. e4",
        probabilities: {
          "1. e4": 0.7,
          "2. d4": 0.2,
          "3. Nf3": 0.05,
          "4. h4": 0.05,
        },
      },
      OPTIONS,
    );
    expect(read.move).toEqual({ san: "e4" });
    expect(read.reasoning).toBe(
      "Jev picked this with 70% probability. Runner-up: d4 (20%).",
    );
  });

  it("turns the probabilities into weighted votes and drops slivers under 1%", () => {
    const read = readJevChoice(
      {
        type: "choice",
        choice: "1. e4",
        probabilities: {
          "1. e4": 0.7,
          "2. d4": 0.2,
          "3. Nf3": 0.096,
          "4. h4": 0.004,
        },
      },
      OPTIONS,
    );
    expect(read.distribution).toEqual([
      { move: { san: "e4" }, weight: 0.7 },
      { move: { san: "d4" }, weight: 0.2 },
      { move: { san: "Nf3" }, weight: 0.096 },
    ]);
  });

  it("ignores probability mass on keys that were never offered", () => {
    const read = readJevChoice(
      {
        type: "choice",
        choice: "2. d4",
        probabilities: { "2. d4": 0.9, "9. Qh5": 0.1 },
      },
      OPTIONS,
    );
    expect(read.distribution).toEqual([{ move: { san: "d4" }, weight: 0.9 }]);
  });

  it("is one whole vote with a plain line when no distribution came back", () => {
    const read = readJevChoice({ type: "choice", choice: "4. h4" }, OPTIONS);
    expect(read.move).toEqual({ san: "h4" });
    expect(read.reasoning).toBe("Jev picked this option.");
    expect(read.distribution).toEqual([{ move: { san: "h4" }, weight: 1 }]);
  });

  it("throws when the choice is not one of the offered options", () => {
    expect(() =>
      readJevChoice({ type: "choice", choice: "9. Qh5" }, OPTIONS),
    ).toThrow("not an offered option");
  });
});

describe("readTypesafeConfidence", () => {
  it("reads the action's confidence off TypeSafe's provider metadata", () => {
    expect(
      readTypesafeConfidence({
        typesafe: { confidence: { action: 0.83, winning: 0.4 } },
      }),
    ).toBe(0.83);
  });

  it("is undefined when the provider sent something else", () => {
    expect(readTypesafeConfidence(undefined)).toBeUndefined();
    expect(readTypesafeConfidence({ typesafe: {} })).toBeUndefined();
  });
});
