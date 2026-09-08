import { describe, expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import { isDecisionChoice } from "../types/pending-choice";
import type { CardName } from "../types/game-state";

function setup(hand: CardName[]) {
  const engine = new DominionEngine();
  engine.startGame(["human", "opponent"], ["Remodel", "Throne Room"]);
  engine.applyExternalEvents([
    { type: "INITIAL_DECK_DEALT", playerId: "human", cards: hand },
    { type: "INITIAL_HAND_DRAWN", playerId: "human", cards: hand },
  ]);
  return engine;
}

function expectPublicDecision(
  engine: DominionEngine,
  intent: Extract<
    import("../types/pending-choice").PendingChoice,
    { choiceType: "decision" }
  >["intent"],
) {
  const choice = engine.state.pendingChoice;
  expect(isDecisionChoice(choice)).toBe(true);
  if (!isDecisionChoice(choice)) throw new Error("Expected a decision");
  expect(choice.intent).toBe(intent);
  for (const internalField of [
    "stage",
    "metadata",
    "memory",
    "trigger",
    "cause",
    "operations",
  ]) {
    expect(choice).not.toHaveProperty(internalField);
  }
  return choice;
}

function select(engine: DominionEngine, selectedCards: CardName[]) {
  const result = engine.submitDecision("human", { selectedCards });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
}

describe("Public choice contract", () => {
  it("keeps Remodel's saved gain limit out of the public choice across reload", () => {
    let engine = setup(["Remodel", "Estate"]);
    expect(engine.playAction("human", "Remodel").ok).toBe(true);
    expectPublicDecision(engine, "trash");
    select(engine, ["Estate"]);
    const choice = expectPublicDecision(engine, "gain");
    expect(choice.cardOptions).toContain("Silver");
    expect(choice.cardOptions).not.toContain("Gold");
    engine = DominionEngine.deserialize(engine.serialize());
    expectPublicDecision(engine, "gain");
    select(engine, ["Silver"]);
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.players.human!.discard).toContain("Silver");
  });

  it("keeps nested play bookkeeping out of each player choice", () => {
    let engine = setup(["Throne Room", "Remodel", "Estate", "Silver"]);
    expect(engine.playAction("human", "Throne Room").ok).toBe(true);
    expectPublicDecision(engine, "play");
    select(engine, ["Remodel"]);
    expectPublicDecision(engine, "trash");
    select(engine, ["Estate"]);
    expectPublicDecision(engine, "gain");
    select(engine, ["Silver"]);
    engine = DominionEngine.deserialize(engine.serialize());
    expectPublicDecision(engine, "trash");
    select(engine, ["Silver"]);
    expectPublicDecision(engine, "gain");
    select(engine, ["Duchy"]);
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.players.human!.discard).toEqual(["Silver", "Duchy"]);
  });
});
