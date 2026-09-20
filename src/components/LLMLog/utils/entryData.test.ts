import { describe, expect, it } from "bun:test";
import { MODEL_IDS } from "../../../config/models";
import { readMove, readPending, readProvider, readVotes } from "./entryData";

/**
 * Both names come from the roster itself: one it ships and one it cannot,
 * so editing the model list can never quietly invert what this asserts.
 */
const shipped = MODEL_IDS[0] ?? "claude-opus-5";
const retired = `${MODEL_IDS.join("-")}-retired`;

describe("reading a log entry's data", () => {
  it("keeps a roster that names a model this build no longer ships", () => {
    expect(MODEL_IDS).toContain(shipped);
    expect(MODEL_IDS).not.toContain(retired);
    const pending = readPending({
      providers: [shipped, retired],
      totalModels: 2,
      phase: "move",
      legalKeys: ["Nc6"],
    });
    expect(pending?.providers).toEqual([shipped]);
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
