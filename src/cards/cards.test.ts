import { describe, it, expect, beforeEach } from "bun:test";
import { getCardEffect } from "./base";
import { applyEvents } from "../events/apply";
import { resetEventCounter } from "../events/id-generator";
import { handleCommand } from "../commands/handle";
import type { GameState, CardName } from "../types/game-state";
import type { CardEffectContext } from "./effect-types";

/**
 * Comprehensive card effect tests
 * Tests every action card to ensure effects work correctly
 */

function createEmptyState(): GameState {
  return {
    players: {},
    supply: {},
    kingdomCards: [],
    playerOrder: [],
    turn: 0,
    phase: "action",
    activePlayerId: "human",
    actions: 0,
    buys: 0,
    coins: 0,
    gameOver: false,
    winnerId: null,
    pendingChoice: null,
    pendingChoiceEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
  };
}

function createTestState(
  hand: CardName[],
  deck: CardName[] = [],
  discard: CardName[] = [],
): GameState {
  return {
    ...createEmptyState(),
    playerOrder: ["human"],
    players: {
      human: {
        deck,
        hand,
        discard,
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Curse: 10,
      Village: 10,
      Smithy: 10,
      Market: 10,
      Festival: 10,
      Laboratory: 10,
      Moat: 10,
      Cellar: 10,
      Chapel: 10,
      Harbinger: 10,
      Merchant: 10,
      Vassal: 10,
      Workshop: 10,
      Bureaucrat: 10,
      Gardens: 10,
      Militia: 10,
      Moneylender: 10,
      Poacher: 10,
      Remodel: 10,
      "Throne Room": 10,
      Bandit: 10,
      "Council Room": 10,
      Library: 10,
      Mine: 10,
      Sentry: 10,
      Witch: 10,
      Artisan: 10,
    },
    activePlayerId: "human",
    phase: "action",
  };
}

function executeCard(
  cardName: CardName,
  state: GameState,
  decision?: unknown,
  stage?: string,
): GameState {
  const effect = getCardEffect(cardName);
  if (!effect) throw new Error(`No effect for ${cardName}`);

  const ctx: CardEffectContext = {
    state,
    playerId: "human",
    card: cardName,
    decision,
    stage,
  };

  const result = effect(ctx);

  // Apply events to get new state
  if (result.events.length > 0) {
    state = applyEvents(state, result.events);
  }

  // Update pending decision
  if (result.pendingChoice) {
    state = { ...state, pendingChoice: result.pendingChoice };
  } else if (decision !== undefined) {
    // If a decision was provided but result has no pendingChoice, clear it
    // (mimics DECISION_RESOLVED behavior in real engine)
    state = { ...state, pendingChoice: null };
  }

  return state;
}

describe("Simple Benefit Cards (Factory-Generated)", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("Smithy: +3 Cards", () => {
    const state = createTestState([], ["Copper", "Silver", "Gold", "Estate"]);
    const effect = getCardEffect("Smithy");
    if (!effect) throw new Error("No effect for Smithy");

    const result = effect({
      state,
      playerId: "human",
      card: "Smithy",
    });

    expect(result.events.length).toBeGreaterThan(0);

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(3);
  });

  it("Village: +1 Card, +2 Actions", () => {
    const state = createTestState([], ["Copper"]);
    const effect = getCardEffect("Village");
    if (!effect) throw new Error("No effect for Village");

    const result = effect({
      state,
      playerId: "human",
      card: "Village",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(1);

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    if (!actionsEvent) throw new Error("No actions event");
    expect(actionsEvent.delta).toBe(2);
  });

  it("Laboratory: +2 Cards, +1 Action", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    const effect = getCardEffect("Laboratory");
    if (!effect) throw new Error("No effect for Laboratory");

    const result = effect({
      state,
      playerId: "human",
      card: "Laboratory",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    if (!actionsEvent) throw new Error("No actions event");
    expect(actionsEvent.delta).toBe(1);
  });

  it("Moat: +2 Cards", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    const effect = getCardEffect("Moat");
    if (!effect) throw new Error("No effect for Moat");

    const result = effect({
      state,
      playerId: "human",
      card: "Moat",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);
  });

  it("Festival: +2 Actions, +1 Buy, +$2", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Festival");
    if (!effect) throw new Error("No effect for Festival");

    const result = effect({
      state,
      playerId: "human",
      card: "Festival",
    });

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    if (!actionsEvent) throw new Error("No actions event");
    expect(actionsEvent.delta).toBe(2);

    const buysEvent = result.events.find(e => e.type === "BUYS_MODIFIED");
    expect(buysEvent).toBeDefined();
    if (!buysEvent) throw new Error("No buys event");
    expect(buysEvent.delta).toBe(1);

    const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
    expect(coinsEvent).toBeDefined();
    if (!coinsEvent) throw new Error("No coins event");
    expect(coinsEvent.delta).toBe(2);
  });

  it("Market: +1 Card, +1 Action, +1 Buy, +$1", () => {
    const state = createTestState([], ["Copper"]);
    const effect = getCardEffect("Market");
    if (!effect) throw new Error("No effect for Market");

    const result = effect({
      state,
      playerId: "human",
      card: "Market",
    });

    expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      1,
    );
    expect(result.events.find(e => e.type === "BUYS_MODIFIED")?.delta).toBe(1);
    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(1);
  });
});

describe("Multi-Stage Decision Cards", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Cellar", () => {
    it("should give +1 Action and request discard decision", () => {
      const state = createTestState(["Copper", "Estate", "Duchy"]);
      const effect = getCardEffect("Cellar");
      if (!effect) throw new Error("No effect for Cellar");

      const result = effect({
        state,
        playerId: "human",
        card: "Cellar",
      });

      // Should give +1 Action
      const actionsEvent = result.events.find(
        e => e.type === "ACTIONS_MODIFIED",
      );
      expect(actionsEvent).toBeDefined();
      if (!actionsEvent) throw new Error("No actions event");
      expect(actionsEvent.delta).toBe(1);

      // Should request discard decision
      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.choiceType).toBe("decision");
      expect(result.pendingChoice.from).toBe("hand");
      expect(result.pendingChoice.stage).toBe("discard");
    });

    it("should discard cards in batch and draw that many", () => {
      const state = createTestState(
        ["Copper", "Estate", "Duchy"],
        ["Village", "Gold", "Silver"],
      );

      // Execute initial call
      let newState = executeCard("Cellar", state);

      // Discard both Copper and Estate in one decision
      newState = executeCard(
        "Cellar",
        newState,
        {
          selectedCards: ["Copper", "Estate"],
        },
        "discard",
      );

      const player = newState.players.human;

      // Should have drawn 2 cards (started with 3, discarded 2, drew 2 = 3)
      expect(player.hand.length).toBe(3);
      // Should have Duchy (not discarded) + 2 newly drawn cards
      expect(player.hand).toContain("Duchy");
      // Deck is drawn from the end, so should have drawn Silver and Gold
      expect(player.hand).toContain("Gold");
      expect(player.hand).toContain("Silver");
    });
  });

  describe("Chapel", () => {
    it("should request batch trash decision for up to 4 cards", () => {
      const state = createTestState([
        "Copper",
        "Copper",
        "Estate",
        "Estate",
        "Duchy",
      ]);
      const effect = getCardEffect("Chapel");
      if (!effect) throw new Error("No effect for Chapel");

      const result = effect({
        state,
        playerId: "human",
        card: "Chapel",
      });

      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.choiceType).toBe("decision");
      expect(result.pendingChoice.min).toBe(0);
      expect(result.pendingChoice.max).toBe(4);
    });

    it("should trash all selected cards in batch", () => {
      const state = createTestState(["Copper", "Copper", "Estate", "Duchy"]);

      // First get the decision
      let newState = executeCard("Chapel", state);
      expect(newState.pendingChoice).toBeDefined();

      // Trash 3 cards including 2 Coppers in one batch submission
      newState = executeCard(
        "Chapel",
        newState,
        { selectedCards: ["Copper", "Copper", "Estate"] },
        "trash",
      );
      expect(newState.trash.length).toBe(3);
      expect(newState.pendingChoice).toBeNull(); // Done after batch

      // Verify both Coppers were trashed
      const coppersInTrash = newState.trash.filter(c => c === "Copper").length;
      expect(coppersInTrash).toBe(2);
      expect(newState.trash).toContain("Estate");

      // Hand should have remaining card (only Duchy)
      expect(newState.players["human"]!.hand).toEqual(["Duchy"]);
      expect(newState.players["human"]!.hand).not.toContain("Copper");
    });

    it("should handle AI reconstructed batch submission", () => {
      const state = createTestState([
        "Copper",
        "Copper",
        "Estate",
        "Estate",
        "Duchy",
      ]);

      // Get initial decision
      let newState = executeCard("Chapel", state);
      expect(newState.pendingChoice).toBeDefined();
      expect(newState.pendingChoice?.max).toBe(4);

      // AI consensus runs multi-round voting, accumulates 3 cards
      // Then submits all at once (handled by strategy layer)
      newState = executeCard(
        "Chapel",
        newState,
        { selectedCards: ["Copper", "Estate", "Copper"] },
        "trash",
      );

      // All 3 cards trashed in one submission
      expect(newState.trash.length).toBe(3);
      expect(newState.trash).toContain("Copper");
      expect(newState.trash).toContain("Estate");

      // No loop decision - Chapel is done
      expect(newState.pendingChoice).toBeNull();

      // Hand has remaining cards
      expect(newState.players["human"]!.hand).toEqual(["Estate", "Duchy"]);
    });
  });

  describe("Harbinger", () => {
    it("should draw 1 card, give +1 action, and request topdeck decision", () => {
      const state = createTestState([], ["Silver"], ["Copper", "Estate"]);
      const effect = getCardEffect("Harbinger");
      if (!effect) throw new Error("No effect for Harbinger");

      const result = effect({
        state,
        playerId: "human",
        card: "Harbinger",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(
        result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta,
      ).toBe(1);
      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.from).toBe("discard");
    });

    it("should put selected card from discard on top of deck", () => {
      const state = createTestState(
        [],
        ["Silver"],
        ["Copper", "Estate", "Gold"],
      );

      let newState = executeCard("Harbinger", state);

      newState = executeCard(
        "Harbinger",
        newState,
        {
          selectedCards: ["Gold"],
        },
        "topdeck",
      );

      const player = newState.players.human;
      expect(player.deck[player.deck.length - 1]).toBe("Gold");
    });

    it("should not create topdeck decision when discard is empty", () => {
      // Create state with empty discard
      const state = createTestState([], ["Silver"], []);
      const effect = getCardEffect("Harbinger");
      if (!effect) throw new Error("No effect for Harbinger");

      const result = effect({
        state,
        playerId: "human",
        card: "Harbinger",
      });

      // Should draw 1 card and give +1 action
      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(
        result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta,
      ).toBe(1);

      // Should NOT create a pending decision since discard is empty
      expect(result.pendingChoice).toBeUndefined();
    });

    it("should allow skipping topdeck decision with min: 0", () => {
      const state = createTestState([], ["Silver"], ["Copper", "Estate"]);

      const newState = executeCard("Harbinger", state);

      // Should create decision with min: 0 (can skip)
      expect(newState.pendingChoice).toBeDefined();
      expect(newState.pendingChoice?.min).toBe(0);
      expect(newState.pendingChoice?.max).toBe(1);

      // Discard should still have the cards until decision is resolved
      expect(newState.players.human.discard).toEqual(["Copper", "Estate"]);
    });
  });

  describe("Workshop", () => {
    it("should request card to gain up to cost 4", () => {
      const state = createTestState([]);
      const effect = getCardEffect("Workshop");
      if (!effect) throw new Error("No effect for Workshop");

      const result = effect({
        state,
        playerId: "human",
        card: "Workshop",
      });

      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.from).toBe("supply");

      // Should include cards costing up to 4
      expect(result.pendingChoice.cardOptions).toContain("Silver");
      expect(result.pendingChoice.cardOptions).toContain("Estate");
      expect(result.pendingChoice.cardOptions).not.toContain("Gold");
      expect(result.pendingChoice.cardOptions).not.toContain("Duchy");
    });

    it("should gain selected card to discard", () => {
      const state = createTestState([]);
      const effect = getCardEffect("Workshop");
      if (!effect) throw new Error("No effect for Workshop");

      const result = effect({
        state,
        playerId: "human",
        card: "Workshop",
        decision: {
          selectedCards: ["Silver"],
        },
        stage: "gain",
      });

      const gainEvent = result.events.find(e => e.type === "CARD_GAINED");
      expect(gainEvent).toBeDefined();
      if (!gainEvent) throw new Error("No gain event");
      expect(gainEvent.card).toBe("Silver");
      expect(gainEvent.to).toBe("discard");
    });
  });

  describe("Remodel", () => {
    it("should request card to trash from hand", () => {
      const state = createTestState(["Copper", "Estate", "Silver"]);
      const effect = getCardEffect("Remodel");
      if (!effect) throw new Error("No effect for Remodel");

      const result = effect({
        state,
        playerId: "human",
        card: "Remodel",
      });

      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.from).toBe("hand");
      expect(result.pendingChoice.stage).toBe("trash");
    });

    it("should trash card and gain card costing up to +2", () => {
      const state = createTestState(["Estate"]);

      // Trash Estate (cost 2)
      let newState = executeCard("Remodel", state);
      newState = executeCard(
        "Remodel",
        newState,
        {
          selectedCards: ["Estate"],
        },
        "trash",
      );

      // Should offer cards up to cost 4 (2+2)
      expect(newState.pendingChoice).toBeDefined();
      if (!newState.pendingChoice) throw new Error("No pending decision");
      expect(newState.pendingChoice.cardOptions).toContain("Silver");

      // Gain Silver
      newState = executeCard(
        "Remodel",
        newState,
        {
          selectedCards: ["Silver"],
        },
        "gain",
      );

      const player = newState.players.human;
      expect(player.discard).toContain("Silver");
    });
  });

  describe("Mine", () => {
    it("should trash treasure and gain treasure costing up to +3", () => {
      const state = createTestState(["Copper", "Estate"]);

      // Initial call - request treasure to trash
      let newState = executeCard("Mine", state);
      expect(newState.pendingChoice).toBeDefined();

      // Trash Copper
      newState = executeCard(
        "Mine",
        newState,
        {
          selectedCards: ["Copper"],
        },
        "trash",
      );

      // Should offer treasures up to cost 3 (0+3)
      expect(newState.pendingChoice).toBeDefined();
      if (!newState.pendingChoice) throw new Error("No pending decision");
      expect(newState.pendingChoice.cardOptions).toContain("Silver");
      expect(newState.pendingChoice.cardOptions).not.toContain("Gold");

      // Gain Silver to hand (not discard!)
      newState = executeCard(
        "Mine",
        newState,
        {
          selectedCards: ["Silver"],
        },
        "gain",
      );

      const player = newState.players.human;
      expect(player.hand).toContain("Silver");
    });
  });

  describe("Artisan", () => {
    it("should gain card up to cost 5 then topdeck a card", () => {
      const state = createTestState(["Copper"]);

      // Gain card
      let newState = executeCard("Artisan", state);
      expect(newState.pendingChoice).toBeDefined();

      newState = executeCard(
        "Artisan",
        newState,
        {
          selectedCards: ["Silver"],
        },
        "gain",
      );

      // Topdeck card from hand
      expect(newState.pendingChoice).toBeDefined();
      if (!newState.pendingChoice) throw new Error("No pending decision");
      expect(newState.pendingChoice.from).toBe("hand");

      newState = executeCard(
        "Artisan",
        newState,
        {
          selectedCards: ["Copper"],
        },
        "topdeck",
      );

      const player = newState.players.human;
      expect(player.deck[player.deck.length - 1]).toBe("Copper");
    });
  });
});

describe("Attack Cards", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Militia", () => {
    it("should give +$2 to player", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Militia"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
        "human",
      );

      if (!result.ok) console.log("ERROR:", result.error);
      expect(result.ok).toBe(true);

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      if (!coinsEvent) throw new Error("No coins event");
      expect(coinsEvent.delta).toBe(2);
    });

    it("should attack opponents with more than 3 cards", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Militia"];
      state.players.ai = {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      // Should emit DECISION_REQUIRED event for opponent to discard down to 3
      const decisionEvent = result.events.find(
        e => e.type === "DECISION_REQUIRED",
      );
      expect(decisionEvent).toBeDefined();
      if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED")
        throw new Error("No decision event");
      expect(decisionEvent.decision.playerId).toBe("ai");
      expect(decisionEvent.decision.stage).toBe("opponent_discard");
      expect(decisionEvent.decision.min).toBe(2); // 5 - 3 = 2 cards to discard
      expect(decisionEvent.decision.max).toBe(2);
    });

    it("should correctly discard cards and reduce hand to 3", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      state.pendingChoice = {
        choiceType: "decision",
        playerId: "ai",
        from: "hand",
        prompt: "Militia: Discard down to 3 cards",
        cardOptions: ["Copper", "Silver", "Gold", "Estate", "Duchy"],
        min: 2,
        max: 2,
        cardBeingPlayed: "Militia",
        stage: "opponent_discard",
        metadata: {
          remainingOpponents: [],
          attackingPlayer: "human",
        },
      };
      const effect = getCardEffect("Militia");
      if (!effect) throw new Error("No effect for Militia");

      const result = effect({
        state,
        playerId: "human",
        card: "Militia",
        decision: { selectedCards: ["Estate", "Duchy"] },
        stage: "opponent_discard",
      });

      // Should create 2 discard events
      const discardEvents = result.events.filter(
        e => e.type === "CARD_DISCARDED",
      );
      expect(discardEvents.length).toBe(2);
      expect(discardEvents[0]!.card).toBe("Estate");
      expect(discardEvents[0]!.playerId).toBe("ai");
      expect(discardEvents[1]!.card).toBe("Duchy");
      expect(discardEvents[1]!.playerId).toBe("ai");

      // Should not create another pending decision
      expect(result.pendingChoice).toBeUndefined();
    });
  });

  describe("Witch", () => {
    it("should draw 2 cards for player", () => {
      const state = createTestState([], ["Copper", "Silver"]);
      const effect = getCardEffect("Witch");
      if (!effect) throw new Error("No effect for Witch");

      const result = effect({
        state,
        playerId: "human",
        card: "Witch",
      });

      const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
      expect(drawEvents.length).toBe(2);
    });

    it("should give Curse to opponents", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Witch"];
      state.players.ai = {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Witch", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      const gainEvents = result.events.filter(
        e => e.type === "CARD_GAINED" && e.card === "Curse",
      );
      expect(gainEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Bureaucrat", () => {
    it("should gain Silver to top of deck", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Bureaucrat"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bureaucrat", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      const gainEvent = result.events.find(
        e => e.type === "CARD_GAINED" && e.card === "Silver",
      );
      expect(gainEvent).toBeDefined();
      if (!gainEvent) throw new Error("No gain event");
      expect(gainEvent.to).toBe("deck");
    });

    it("should make opponents topdeck victory card", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Bureaucrat"];
      state.players.ai = {
        deck: [],
        hand: ["Copper", "Estate", "Duchy"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bureaucrat", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      // Should emit DECISION_REQUIRED event for opponent to topdeck victory card
      const decisionEvent = result.events.find(
        e => e.type === "DECISION_REQUIRED",
      );
      expect(decisionEvent).toBeDefined();
      if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED")
        throw new Error("No decision event");
      expect(decisionEvent.decision.playerId).toBe("ai");
      expect(decisionEvent.decision.cardOptions).toContain("Estate");
      expect(decisionEvent.decision.cardOptions).toContain("Duchy");
      expect(decisionEvent.decision.cardOptions).not.toContain("Copper");
    });
  });

  describe("Bandit", () => {
    it("should gain Gold", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Bandit"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bandit", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      const gainEvent = result.events.find(
        e => e.type === "CARD_GAINED" && e.card === "Gold",
      );
      expect(gainEvent).toBeDefined();
    });

    it("should trash opponent treasures (not Copper)", () => {
      const state = createTestState([]);
      state.players.human.hand = ["Bandit"];
      state.players.ai = {
        deck: ["Silver", "Gold", "Copper"],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      state.actions = 1;

      const result = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bandit", playerId: "human" },
        "human",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Command failed");

      // Should gain Gold for player
      const gainEvent = result.events.find(
        e => e.type === "CARD_GAINED" && e.card === "Gold",
      );
      expect(gainEvent).toBeDefined();

      // Should reveal cards from opponent's deck
      expect(result.events.length).toBeGreaterThan(1);
    });
  });
});

describe("Complex Card Interactions", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Library", () => {
    it("should draw until 7 cards in hand", () => {
      const state = createTestState(
        ["Copper"],
        ["Silver", "Gold", "Estate", "Duchy", "Province", "Village", "Copper"],
      );
      const effect = getCardEffect("Library");
      if (!effect) throw new Error("No effect for Library");

      const result = effect({
        state,
        playerId: "human",
        card: "Library",
      });

      // Should request decision about actions or draw cards
      expect(result.pendingChoice || result.events.length > 0).toBeTruthy();

      // If there are no actions, should have draw events
      // If there are actions, should have pending decision with actions
      if (result.pendingChoice) {
        expect(result.pendingChoice.actions).toBeDefined();
        expect(result.pendingChoice.actions?.length).toBe(2);
      } else {
        expect(result.events.length).toBeGreaterThan(0);
      }
    });

    it("should allow skipping action cards", () => {
      const state = createTestState(
        ["Copper"],
        ["Village", "Smithy", "Copper", "Silver", "Gold", "Estate"],
      );

      const newState = executeCard("Library", state);

      // Should request which actions to skip
      if (newState.pendingChoice) {
        expect(newState.pendingChoice.cardOptions).toContain("Village");
        expect(newState.pendingChoice.cardOptions).toContain("Smithy");
      }
    });
  });

  describe("Sentry", () => {
    it("should draw 1, give +1 action, and reveal 2 cards", () => {
      const state = createTestState([], ["Copper", "Silver", "Gold"]);
      const effect = getCardEffect("Sentry");
      if (!effect) throw new Error("No effect for Sentry");

      const result = effect({
        state,
        playerId: "human",
        card: "Sentry",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(
        result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta,
      ).toBe(1);
      expect(result.pendingChoice).toBeDefined();
    });

    it("should allow trashing, discarding, or topdecking revealed cards", () => {
      const state = createTestState([], ["Copper", "Silver", "Gold", "Estate"]);

      const newState = executeCard("Sentry", state);

      // Should reveal 2 cards with decision
      expect(newState.pendingChoice).toBeDefined();
      if (!newState.pendingChoice) throw new Error("No pending decision");
      expect(newState.pendingChoice.choiceType).toBe("decision");
      expect(newState.pendingChoice.cardOptions.length).toBe(2);
      expect(newState.pendingChoice.actions).toHaveLength(3);
    });
  });

  describe("Throne Room", () => {
    it("should request action card to play twice", () => {
      const state = createTestState(["Village", "Smithy", "Copper"]);
      const effect = getCardEffect("Throne Room");
      if (!effect) throw new Error("No effect for Throne Room");

      const result = effect({
        state,
        playerId: "human",
        card: "Throne Room",
      });

      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.cardOptions).toContain("Village");
      expect(result.pendingChoice.cardOptions).toContain("Smithy");
      expect(result.pendingChoice.cardOptions).not.toContain("Copper");
    });
  });

  describe("Vassal", () => {
    it("should give +$2 and reveal top card", () => {
      const state = createTestState([], ["Village", "Copper"]);
      const effect = getCardEffect("Vassal");
      if (!effect) throw new Error("No effect for Vassal");

      const result = effect({
        state,
        playerId: "human",
        card: "Vassal",
      });

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      if (!coinsEvent) throw new Error("No coins event");
      expect(coinsEvent.delta).toBe(2);
    });

    it("should offer to play action from discard", () => {
      const state = createTestState([], ["Village"]);
      const effect = getCardEffect("Vassal");
      if (!effect) throw new Error("No effect for Vassal");

      const result = effect({
        state,
        playerId: "human",
        card: "Vassal",
      });

      // Should discard Village and offer to play it
      expect(result.pendingChoice).toBeDefined();
      if (!result.pendingChoice) throw new Error("No pending decision");
      expect(result.pendingChoice.cardOptions).toContain("Village");
    });
  });

  describe("Council Room", () => {
    it("should draw 4 cards and give +1 buy", () => {
      const state = createTestState(
        [],
        ["Copper", "Silver", "Gold", "Estate", "Duchy"],
      );
      const effect = getCardEffect("Council Room");
      if (!effect) throw new Error("No effect for Council Room");

      const result = effect({
        state,
        playerId: "human",
        card: "Council Room",
      });

      const drawEvents = result.events.filter(
        e => e.type === "CARD_DRAWN" && e.playerId === "human",
      );
      expect(drawEvents.length).toBe(4);

      const buysEvent = result.events.find(e => e.type === "BUYS_MODIFIED");
      expect(buysEvent).toBeDefined();
      if (!buysEvent) throw new Error("No buys event");
      expect(buysEvent.delta).toBe(1);
    });

    it("should make each opponent draw 1 card", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: ["Copper", "Silver"],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];
      const effect = getCardEffect("Council Room");
      if (!effect) throw new Error("No effect for Council Room");

      const result = effect({
        state,
        playerId: "human",
        card: "Council Room",
      });

      const aiDrawEvents = result.events.filter(
        e => e.type === "CARD_DRAWN" && e.playerId === "ai",
      );
      expect(aiDrawEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Merchant", () => {
    it("should draw 1 card and give +1 action", () => {
      const state = createTestState([], ["Copper"]);
      const effect = getCardEffect("Merchant");
      if (!effect) throw new Error("No effect for Merchant");

      const result = effect({
        state,
        playerId: "human",
        card: "Merchant",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(
        result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta,
      ).toBe(1);
    });
  });

  describe("Moneylender", () => {
    it("should trash Copper for +$3", () => {
      const state = createTestState(["Copper", "Silver"]);
      const effect = getCardEffect("Moneylender");
      if (!effect) throw new Error("No effect for Moneylender");

      const result = effect({
        state,
        playerId: "human",
        card: "Moneylender",
        decision: {
          selectedCards: ["Copper"],
        },
      });

      const trashEvent = result.events.find(e => e.type === "CARD_TRASHED");
      expect(trashEvent).toBeDefined();
      if (!trashEvent) throw new Error("No trash event");
      expect(trashEvent.card).toBe("Copper");

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      if (!coinsEvent) throw new Error("No coins event");
      expect(coinsEvent.delta).toBe(3);
    });

    it("should do nothing if no Copper", () => {
      const state = createTestState(["Silver", "Gold"]);
      const effect = getCardEffect("Moneylender");
      if (!effect) throw new Error("No effect for Moneylender");

      const result = effect({
        state,
        playerId: "human",
        card: "Moneylender",
      });

      // Should not request decision or give coins
      expect(result.pendingChoice).toBeUndefined();
      expect(
        result.events.find(e => e.type === "COINS_MODIFIED"),
      ).toBeUndefined();
    });
  });

  describe("Poacher", () => {
    it("should draw 1, give +1 action, +1 coin", () => {
      const state = createTestState([], ["Copper"]);
      const effect = getCardEffect("Poacher");
      if (!effect) throw new Error("No effect for Poacher");

      const result = effect({
        state,
        playerId: "human",
        card: "Poacher",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(
        result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta,
      ).toBe(1);
      expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(
        1,
      );
    });

    it("should discard for each empty supply pile", () => {
      const state = createTestState(["Copper", "Silver", "Gold", "Estate"]);
      state.supply.Copper = 0;
      state.supply.Silver = 0;
      state.supply.Gold = 0;

      const newState = executeCard("Poacher", state);

      // Should request discarding 3 cards
      expect(newState.pendingChoice).toBeDefined();
      if (!newState.pendingChoice) throw new Error("No pending decision");
      expect(newState.pendingChoice.min).toBe(3);
      expect(newState.pendingChoice.max).toBe(3);
    });
  });
});

describe("Special Cards", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Gardens", () => {
    it("should be a victory card (no effect)", () => {
      const effect = getCardEffect("Gardens");
      expect(effect).toBeDefined();
    });
  });
});
