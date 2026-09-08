import { describe, expect, test } from "bun:test";
import { DominionEngine } from "../engine";
import { getLegalActions } from "../agent/legal-actions";
import type { CardName } from "../types/game-state";
import { isDecisionChoice } from "../types/pending-choice";
import { getCardCost } from "./cost";

function createEngine(hand: CardName[], reductions: number[]) {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], ["Workshop", "Artisan", "Remodel", "Mine"]);
  engine.loadEvents([
    ...engine.eventLog,
    ...reductions.map(amount => ({
      type: "EFFECT_REGISTERED" as const,
      effectType: "cost_reduction" as const,
      playerId: "human",
      source: "Workshop" as const,
      parameters: { amount },
    })),
  ]);
  engine.state.players.human!.hand = hand;
  return engine;
}

function gainOptions(engine: DominionEngine) {
  const choice = engine.state.pendingChoice;
  expect(isDecisionChoice(choice)).toBe(true);
  if (!isDecisionChoice(choice)) throw new Error("Expected gain choice");
  expect(choice.from).toBe("supply");
  return choice.cardOptions;
}

describe("current card costs", () => {
  test("combines reductions and floors the final cost at zero", () => {
    const engine = createEngine([], [2, 2]);
    expect(getCardCost(engine.state, "Silver")).toEqual({
      baseCost: 3,
      modifiedCost: 0,
      modifiers: [
        { source: "Workshop", delta: -2 },
        { source: "Workshop", delta: -2 },
      ],
    });
  });

  test("legal purchases and executed purchases use the same cost", () => {
    const engine = createEngine([], [2]);
    engine.state.phase = "buy";
    engine.state.coins = 4;
    expect(getLegalActions(engine.state)).toContainEqual({
      type: "buy_card",
      card: "Gold",
    });
    expect(getLegalActions(engine.state)).not.toContainEqual({
      type: "buy_card",
      card: "Province",
    });
    expect(engine.buyCard("human", "Gold").ok).toBe(true);
    expect(engine.state.coins).toBe(0);
    expect(engine.state.players.human!.discard).toContain("Gold");
  });

  test("Workshop gains discounted cards without spending coins or buys", () => {
    const engine = createEngine(["Workshop"], [2]);
    expect(engine.playAction("human", "Workshop").ok).toBe(true);
    expect(gainOptions(engine)).toContain("Gold");
    expect(gainOptions(engine)).not.toContain("Province");
    expect(engine.submitDecision("human", { selectedCards: ["Gold"] }).ok).toBe(
      true,
    );
    expect(engine.state.players.human!.discard).toContain("Gold");
    expect(engine.state.coins).toBe(0);
    expect(engine.state.buys).toBe(1);
  });

  test("Remodel compares the discounted costs of both cards", () => {
    const engine = createEngine(["Remodel", "Silver"], [2]);
    expect(engine.playAction("human", "Remodel").ok).toBe(true);
    expect(
      engine.submitDecision("human", { selectedCards: ["Silver"] }).ok,
    ).toBe(true);
    // Silver costs $1, so the replacement may cost up to $3.
    expect(gainOptions(engine)).toContain("Duchy");
    expect(gainOptions(engine)).not.toContain("Gold");
    expect(
      engine.submitDecision("human", { selectedCards: ["Duchy"] }).ok,
    ).toBe(true);
    expect(engine.state.trash).toContain("Silver");
    expect(engine.state.players.human!.discard).toContain("Duchy");
  });

  test("Mine upgrades a zero-cost Copper to discounted Gold in hand", () => {
    const engine = createEngine(["Mine", "Copper"], [3]);
    expect(engine.playAction("human", "Mine").ok).toBe(true);
    expect(
      engine.submitDecision("human", { selectedCards: ["Copper"] }).ok,
    ).toBe(true);
    expect(gainOptions(engine)).toContain("Gold");
    expect(gainOptions(engine)).not.toContain("Duchy");
    expect(engine.submitDecision("human", { selectedCards: ["Gold"] }).ok).toBe(
      true,
    );
    expect(engine.state.trash).toContain("Copper");
    expect(engine.state.players.human!.hand).toContain("Gold");
  });
});
