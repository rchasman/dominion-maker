import { describe, expect, it } from "bun:test";
import { createGame } from "../engine";
import { optimizeStateForAI } from "./state-projection";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "./strategic-context";

const position = () =>
  createGame(["human", "ai", "third"], undefined, 42).state;

describe("decision context regression positions", () => {
  it("uses the defender's hand, strategy and identity for Militia", () => {
    const state = position();
    state.players.ai!.hand = ["Smithy", "Silver", "Estate", "Copper", "Gold"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "ai",
      cardBeingPlayed: "Militia",
      prompt: "Discard to 3",
      cardOptions: state.players.ai!.hand,
      intent: "discard",
      min: 2,
      max: 2,
    };
    const context = optimizeStateForAI(state);
    expect(context.you.playerId).toBe("ai");
    expect(context.you.currentHand).toEqual({
      Smithy: 1,
      Silver: 1,
      Estate: 1,
      Copper: 1,
      Gold: 1,
    });
    expect(context.you.currentCoins).toBeNull();
    expect(context.opponents.map(p => p.playerId)).toEqual(["human", "third"]);
    const strategy = buildStrategicContext(
      state,
      JSON.stringify({
        human: {
          gameplan: "attacker plan",
          decisionPlan: { priority: "attacker plan", conditions: ["attack"] },
          read: "attacker read",
          recommendation: "attack",
        },
        ai: {
          gameplan: "defender plan",
          decisionPlan: {
            priority: "defender plan",
            conditions: ["preserve draw"],
          },
          read: "defender read",
          recommendation: "preserve draw",
        },
      }),
    );
    expect(strategy).toContain("defender plan");
    expect(strategy).not.toContain("attacker plan");
  });

  it("uses the reacting player and exposes only the known top card", () => {
    const state = position();
    state.players.ai!.deck = ["Province", "Gold", "Estate"];
    state.players.ai!.deckTopRevealed = true;
    state.players.ai!.hand = ["Moat"];
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "ai",
      triggeringPlayerId: "human",
      triggeringCard: "Militia",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
    };
    const context = optimizeStateForAI(state);
    expect(context.you.currentHand).toEqual({ Moat: 1 });
    expect(context.you.deckTopCards).toEqual(["Estate"]);
    expect(
      context.opponents.every(
        p => !("currentHand" in p) && !("deckTopCards" in p),
      ),
    ).toBe(true);
    state.players.ai!.deckTopRevealed = false;
    expect(optimizeStateForAI(state).you).not.toHaveProperty("deckTopCards");
  });

  it("projects losing Province endings and winning third-pile Gardens buys", () => {
    const state = position();
    state.phase = "buy";
    state.coins = 8;
    state.players.human!.hand = [];
    state.players.ai!.hand = ["Province", "Province", "Province"];
    state.supply.Province = 1;
    const province = optimizeStateForAI(
      state,
    ).decisionFacts.purchaseConsequences.find(p => p.card === "Province")!;
    expect(province.triggersGameEnd).toBe(true);
    expect(province.winnerIdIfNoFurtherChanges).toBe("ai");
    state.supply.Province = 8;
    state.supply.Gardens = 1;
    state.supply.Estate = 0;
    state.supply.Duchy = 0;
    state.players.human!.deck = Array(40).fill("Copper");
    state.players.human!.hand = Array(5).fill("Gardens");
    const gardens = optimizeStateForAI(
      state,
    ).decisionFacts.purchaseConsequences.find(p => p.card === "Gardens")!;
    expect(gardens.triggersGameEnd).toBe(true);
    expect(gardens.winnerIdIfNoFurtherChanges).toBe("human");
    expect(gardens.vpAfterPurchase).toBeGreaterThan(20);
    expect(state.supply.Gardens).toBe(1);
  });

  it("reports draw/action balance and shuffle proximity without hidden order", () => {
    const state = position();
    state.players.human = {
      hand: ["Village", "Smithy"],
      deck: ["Gold"],
      discard: ["Copper"],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    const facts = optimizeStateForAI(state).decisionFacts;
    expect(facts.totalCards).toBe(4);
    expect(facts.terminalActions).toBe(1);
    expect(facts.printedExtraActions).toBe(1);
    expect(facts.printedDrawCards).toBe(4);
    expect(facts.nextFiveCardDrawNeedsShuffle).toBe(true);
  });

  it("preserves player IDs and nested gain/trash history", () => {
    const state = position();
    state.log = [
      { type: "turn-start", playerId: "ai", turn: 2 },
      {
        type: "play-action",
        playerId: "ai",
        card: "Remodel",
        children: [
          { type: "trash-card", playerId: "ai", cards: ["Estate"] },
          { type: "gain-card", playerId: "ai", card: "Smithy" },
        ],
      },
    ];
    const history = formatTurnHistoryForAnalysis(state);
    expect(history).toContain("ai");
    expect(history).toContain("Estate");
    expect(history).toContain("Smithy");
    expect(history).not.toContain("opponent");
  });

  it("falls back safely for corrupt or missing player summaries", () => {
    ["not JSON", "null", "{}", '{"human":{"gameplan":3}}'].map(summary => {
      expect(buildStrategicContext(position(), summary)).toContain(
        "No analysis yet",
      );
    });
  });
});
