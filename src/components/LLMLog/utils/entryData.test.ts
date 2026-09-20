import { describe, expect, it } from "bun:test";
import { readMove, readPending, readProvider, readVotes } from "./entryData";

describe("reading a log entry's data", () => {
  it("keeps a roster that names a model this build no longer ships", () => {
    const pending = readPending({
      providers: ["gpt-5.4-nano", "retired-model-v1"],
      totalModels: 2,
      phase: "move",
      legalKeys: ["Nc6"],
    });
    expect(pending?.providers).toEqual(["gpt-5.4-nano"]);
    expect(pending?.legalKeys).toEqual(["Nc6"]);
  });

  it("reads a move of any game and refuses what is not one", () => {
    const chess = { san: "Nc6", from: "b8", to: "c6" };
    expect(readMove(chess)).toMatchObject(chess);
    expect(readMove("Nc6")).toBeUndefined();
    expect(readProvider("not-a-model")).toBeUndefined();
  });

  it("reads a weighted spread and refuses a malformed one", () => {
    const spread = [{ move: { san: "Nc6" }, weight: 1, key: "Nc6" }];
    expect(readVotes(spread)).toMatchObject(spread);
    expect(readVotes([{ move: { san: "Nc6" } }])).toBeUndefined();
  });
});
