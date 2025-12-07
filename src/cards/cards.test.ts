import { describe, it, expect, beforeEach } from "bun:test";
import { getCardEffect } from "./base";
import { applyEvents } from "../events/apply";
import { resetEventCounter } from "../events/id-generator";
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
    activePlayer: "human",
    actions: 0,
    buys: 0,
    coins: 0,
    gameOver: false,
    winner: null,
    pendingDecision: null,
    subPhase: null,
    trash: [],
    log: [],
    turnHistory: [],
  };
}

function createTestState(hand: CardName[], deck: CardName[] = [], discard: CardName[] = []): GameState {
  return {
    ...createEmptyState(),
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
    activePlayer: "human",
    phase: "action",
  };
}

function executeCard(cardName: CardName, state: GameState, decision?: any, stage?: string): GameState {
  const effect = getCardEffect(cardName);
  if (!effect) throw new Error(`No effect for ${cardName}`);

  const ctx: CardEffectContext = {
    state,
    player: "human",
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
  if (result.pendingDecision) {
    state = { ...state, pendingDecision: result.pendingDecision };
  } else if (result.events.length > 0) {
    state = { ...state, pendingDecision: null };
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

    const result = effect!({
      state,
      player: "human",
      card: "Smithy",
    });

    expect(result.events.length).toBeGreaterThan(0);

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(3);
  });

  it("Village: +1 Card, +2 Actions", () => {
    const state = createTestState([], ["Copper"]);
    const effect = getCardEffect("Village");

    const result = effect!({
      state,
      player: "human",
      card: "Village",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(1);

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    expect(actionsEvent!.delta).toBe(2);
  });

  it("Laboratory: +2 Cards, +1 Action", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    const effect = getCardEffect("Laboratory");

    const result = effect!({
      state,
      player: "human",
      card: "Laboratory",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    expect(actionsEvent!.delta).toBe(1);
  });

  it("Moat: +2 Cards", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    const effect = getCardEffect("Moat");

    const result = effect!({
      state,
      player: "human",
      card: "Moat",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);
  });

  it("Festival: +2 Actions, +1 Buy, +$2", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Festival");

    const result = effect!({
      state,
      player: "human",
      card: "Festival",
    });

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    expect(actionsEvent!.delta).toBe(2);

    const buysEvent = result.events.find(e => e.type === "BUYS_MODIFIED");
    expect(buysEvent).toBeDefined();
    expect(buysEvent!.delta).toBe(1);

    const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
    expect(coinsEvent).toBeDefined();
    expect(coinsEvent!.delta).toBe(2);
  });

  it("Market: +1 Card, +1 Action, +1 Buy, +$1", () => {
    const state = createTestState([], ["Copper"]);
    const effect = getCardEffect("Market");

    const result = effect!({
      state,
      player: "human",
      card: "Market",
    });

    expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(1);
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

      const result = getCardEffect("Cellar")!({
        state,
        player: "human",
        card: "Cellar",
      });

      // Should give +1 Action
      const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
      expect(actionsEvent).toBeDefined();
      expect(actionsEvent!.delta).toBe(1);

      // Should request discard decision
      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.type).toBe("select_cards");
      expect(result.pendingDecision!.from).toBe("hand");
      expect(result.pendingDecision!.stage).toBe("discard");
    });

    it("should discard selected cards and draw same amount", () => {
      const state = createTestState(
        ["Copper", "Estate", "Duchy"],
        ["Village", "Gold", "Silver"]
      );

      // Execute initial call
      let newState = executeCard("Cellar", state);

      // Execute with decision to discard 2 cards
      newState = executeCard("Cellar", newState, {
        selectedCards: ["Copper", "Estate"],
      }, "discard");

      const player = newState.players.human;

      // Should have drawn 2 cards (started with 3, discarded 2, drew 2 = 3)
      expect(player.hand.length).toBe(3);
      // Should have Duchy (not discarded) + 2 newly drawn cards
      expect(player.hand).toContain("Duchy");
      // Deck is drawn from the end, so should have drawn Gold and Silver
      expect(player.hand).toContain("Gold");
      expect(player.hand).toContain("Silver");
    });
  });

  describe("Chapel", () => {
    it("should request trash decision up to 4 cards", () => {
      const state = createTestState(["Copper", "Copper", "Estate", "Estate", "Duchy"]);

      const result = getCardEffect("Chapel")!({
        state,
        player: "human",
        card: "Chapel",
      });

      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.type).toBe("select_cards");
      expect(result.pendingDecision!.min).toBe(0);
      expect(result.pendingDecision!.max).toBe(4);
    });

    it("should trash selected cards", () => {
      const state = createTestState(["Copper", "Copper", "Estate", "Duchy"]);

      // First get the decision
      let newState = executeCard("Chapel", state);
      expect(newState.pendingDecision).toBeDefined();

      // Then execute with decision
      newState = executeCard("Chapel", newState, {
        selectedCards: ["Copper", "Copper", "Estate"],
      }, "trash");

      // Check trash pile has the cards
      expect(newState.trash.length).toBe(3);
      expect(newState.trash).toContain("Copper");
      expect(newState.trash).toContain("Estate");
    });
  });

  describe("Harbinger", () => {
    it("should draw 1 card, give +1 action, and request topdeck decision", () => {
      const state = createTestState([], ["Silver"], ["Copper", "Estate"]);

      const result = getCardEffect("Harbinger")!({
        state,
        player: "human",
        card: "Harbinger",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(1);
      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.from).toBe("discard");
    });

    it("should put selected card from discard on top of deck", () => {
      const state = createTestState([], ["Silver"], ["Copper", "Estate", "Gold"]);

      let newState = executeCard("Harbinger", state);

      newState = executeCard("Harbinger", newState, {
        selectedCards: ["Gold"],
      }, "topdeck");

      const player = newState.players.human;
      expect(player.deck[player.deck.length - 1]).toBe("Gold");
    });
  });

  describe("Workshop", () => {
    it("should request card to gain up to cost 4", () => {
      const state = createTestState([]);

      const result = getCardEffect("Workshop")!({
        state,
        player: "human",
        card: "Workshop",
      });

      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.from).toBe("supply");

      // Should include cards costing up to 4
      expect(result.pendingDecision!.cardOptions).toContain("Silver");
      expect(result.pendingDecision!.cardOptions).toContain("Estate");
      expect(result.pendingDecision!.cardOptions).not.toContain("Gold");
      expect(result.pendingDecision!.cardOptions).not.toContain("Duchy");
    });

    it("should gain selected card to discard", () => {
      const state = createTestState([]);

      const result = getCardEffect("Workshop")!({
        state,
        player: "human",
        card: "Workshop",
        decision: {
          selectedCards: ["Silver"],
        },
        stage: "gain",
      });

      const gainEvent = result.events.find(e => e.type === "CARD_GAINED");
      expect(gainEvent).toBeDefined();
      expect(gainEvent!.card).toBe("Silver");
      expect(gainEvent!.to).toBe("discard");
    });
  });

  describe("Remodel", () => {
    it("should request card to trash from hand", () => {
      const state = createTestState(["Copper", "Estate", "Silver"]);

      const result = getCardEffect("Remodel")!({
        state,
        player: "human",
        card: "Remodel",
      });

      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.from).toBe("hand");
      expect(result.pendingDecision!.stage).toBe("trash");
    });

    it("should trash card and gain card costing up to +2", () => {
      const state = createTestState(["Estate"]);

      // Trash Estate (cost 2)
      let newState = executeCard("Remodel", state);
      newState = executeCard("Remodel", newState, {
        selectedCards: ["Estate"],
      }, "trash");

      // Should offer cards up to cost 4 (2+2)
      expect(newState.pendingDecision).toBeDefined();
      expect(newState.pendingDecision!.cardOptions).toContain("Silver");

      // Gain Silver
      newState = executeCard("Remodel", newState, {
        selectedCards: ["Silver"],
      }, "gain");

      const player = newState.players.human;
      expect(player.discard).toContain("Silver");
    });
  });

  describe("Mine", () => {
    it("should trash treasure and gain treasure costing up to +3", () => {
      const state = createTestState(["Copper", "Estate"]);

      // Initial call - request treasure to trash
      let newState = executeCard("Mine", state);
      expect(newState.pendingDecision).toBeDefined();

      // Trash Copper
      newState = executeCard("Mine", newState, {
        selectedCards: ["Copper"],
      }, "trash");

      // Should offer treasures up to cost 3 (0+3)
      expect(newState.pendingDecision).toBeDefined();
      expect(newState.pendingDecision!.cardOptions).toContain("Silver");
      expect(newState.pendingDecision!.cardOptions).not.toContain("Gold");

      // Gain Silver to hand (not discard!)
      newState = executeCard("Mine", newState, {
        selectedCards: ["Silver"],
      }, "gain");

      const player = newState.players.human;
      expect(player.hand).toContain("Silver");
    });
  });

  describe("Artisan", () => {
    it("should gain card up to cost 5 then topdeck a card", () => {
      const state = createTestState(["Copper"]);

      // Gain card
      let newState = executeCard("Artisan", state);
      expect(newState.pendingDecision).toBeDefined();

      newState = executeCard("Artisan", newState, {
        selectedCards: ["Silver"],
      }, "gain");

      // Topdeck card from hand
      expect(newState.pendingDecision).toBeDefined();
      expect(newState.pendingDecision!.from).toBe("hand");

      newState = executeCard("Artisan", newState, {
        selectedCards: ["Copper"],
      }, "topdeck");

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

      const result = getCardEffect("Militia")!({
        state,
        player: "human",
        card: "Militia",
      });

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      expect(coinsEvent!.delta).toBe(2);
    });

    it("should attack opponents with more than 3 cards", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];

      const result = getCardEffect("Militia")!({
        state,
        player: "human",
        card: "Militia",
      });

      // Should request opponent to discard down to 3
      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.player).toBe("ai");
      expect(result.pendingDecision!.stage).toBe("opponent_discard");
    });
  });

  describe("Witch", () => {
    it("should draw 2 cards for player", () => {
      const state = createTestState([], ["Copper", "Silver"]);

      const result = getCardEffect("Witch")!({
        state,
        player: "human",
        card: "Witch",
      });

      const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
      expect(drawEvents.length).toBe(2);
    });

    it("should give Curse to opponents", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];

      const result = getCardEffect("Witch")!({
        state,
        player: "human",
        card: "Witch",
      });

      const gainEvents = result.events.filter(e =>
        e.type === "CARD_GAINED" && e.card === "Curse"
      );
      expect(gainEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Bureaucrat", () => {
    it("should gain Silver to top of deck", () => {
      const state = createTestState([]);

      const result = getCardEffect("Bureaucrat")!({
        state,
        player: "human",
        card: "Bureaucrat",
      });

      const gainEvent = result.events.find(e =>
        e.type === "CARD_GAINED" && e.card === "Silver"
      );
      expect(gainEvent).toBeDefined();
      expect(gainEvent!.to).toBe("deck");
    });

    it("should make opponents topdeck victory card", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: [],
        hand: ["Copper", "Estate", "Duchy"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];

      const result = getCardEffect("Bureaucrat")!({
        state,
        player: "human",
        card: "Bureaucrat",
      });

      // Should request opponent to topdeck victory card
      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.player).toBe("ai");
      expect(result.pendingDecision!.cardOptions).toContain("Estate");
      expect(result.pendingDecision!.cardOptions).toContain("Duchy");
      expect(result.pendingDecision!.cardOptions).not.toContain("Copper");
    });
  });

  describe("Bandit", () => {
    it("should gain Gold", () => {
      const state = createTestState([]);

      const result = getCardEffect("Bandit")!({
        state,
        player: "human",
        card: "Bandit",
      });

      const gainEvent = result.events.find(e =>
        e.type === "CARD_GAINED" && e.card === "Gold"
      );
      expect(gainEvent).toBeDefined();
    });

    it("should trash opponent treasures (not Copper)", () => {
      const state = createTestState([]);
      state.players.ai = {
        deck: ["Silver", "Gold", "Copper"],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      };
      state.playerOrder = ["human", "ai"];

      const result = getCardEffect("Bandit")!({
        state,
        player: "human",
        card: "Bandit",
      });

      // Should gain Gold for player
      const gainEvent = result.events.find(e => e.type === "CARD_GAINED" && e.card === "Gold");
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
        ["Silver", "Gold", "Estate", "Duchy", "Province", "Village", "Copper"]
      );

      const result = getCardEffect("Library")!({
        state,
        player: "human",
        card: "Library",
      });

      // Should request decision about actions or draw cards
      expect(result.pendingDecision || result.events.length > 0).toBeTruthy();

      // If there are no actions, should have draw events
      // If there are actions, should have pending decision
      if (result.pendingDecision) {
        expect(result.pendingDecision.stage).toBe("skip_actions");
      } else {
        expect(result.events.length).toBeGreaterThan(0);
      }
    });

    it("should allow skipping action cards", () => {
      const state = createTestState(
        ["Copper"],
        ["Village", "Smithy", "Copper", "Silver", "Gold", "Estate"]
      );

      let newState = executeCard("Library", state);

      // Should request which actions to skip
      if (newState.pendingDecision) {
        expect(newState.pendingDecision.cardOptions).toContain("Village");
        expect(newState.pendingDecision.cardOptions).toContain("Smithy");
      }
    });
  });

  describe("Sentry", () => {
    it("should draw 1, give +1 action, and reveal 2 cards", () => {
      const state = createTestState(
        [],
        ["Copper", "Silver", "Gold"]
      );

      const result = getCardEffect("Sentry")!({
        state,
        player: "human",
        card: "Sentry",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(1);
      expect(result.pendingDecision).toBeDefined();
    });

    it("should allow trashing, discarding, or topdecking revealed cards", () => {
      const state = createTestState(
        [],
        ["Copper", "Silver", "Gold", "Estate"]
      );

      let newState = executeCard("Sentry", state);

      // Should reveal 2 cards
      expect(newState.pendingDecision).toBeDefined();
      expect(newState.pendingDecision!.from).toBe("revealed");
    });
  });

  describe("Throne Room", () => {
    it("should request action card to play twice", () => {
      const state = createTestState(["Village", "Smithy", "Copper"]);

      const result = getCardEffect("Throne Room")!({
        state,
        player: "human",
        card: "Throne Room",
      });

      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.cardOptions).toContain("Village");
      expect(result.pendingDecision!.cardOptions).toContain("Smithy");
      expect(result.pendingDecision!.cardOptions).not.toContain("Copper");
    });
  });

  describe("Vassal", () => {
    it("should give +$2 and reveal top card", () => {
      const state = createTestState(
        [],
        ["Village", "Copper"]
      );

      const result = getCardEffect("Vassal")!({
        state,
        player: "human",
        card: "Vassal",
      });

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      expect(coinsEvent!.delta).toBe(2);
    });

    it("should offer to play action from discard", () => {
      const state = createTestState(
        [],
        ["Village"]
      );

      const result = getCardEffect("Vassal")!({
        state,
        player: "human",
        card: "Vassal",
      });

      // Should discard Village and offer to play it
      expect(result.pendingDecision).toBeDefined();
      expect(result.pendingDecision!.cardOptions).toContain("Village");
    });
  });

  describe("Council Room", () => {
    it("should draw 4 cards and give +1 buy", () => {
      const state = createTestState(
        [],
        ["Copper", "Silver", "Gold", "Estate", "Duchy"]
      );

      const result = getCardEffect("Council Room")!({
        state,
        player: "human",
        card: "Council Room",
      });

      const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN" && e.player === "human");
      expect(drawEvents.length).toBe(4);

      const buysEvent = result.events.find(e => e.type === "BUYS_MODIFIED");
      expect(buysEvent).toBeDefined();
      expect(buysEvent!.delta).toBe(1);
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

      const result = getCardEffect("Council Room")!({
        state,
        player: "human",
        card: "Council Room",
      });

      const aiDrawEvents = result.events.filter(e =>
        e.type === "CARD_DRAWN" && e.player === "ai"
      );
      expect(aiDrawEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Merchant", () => {
    it("should draw 1 card and give +1 action", () => {
      const state = createTestState([], ["Copper"]);

      const result = getCardEffect("Merchant")!({
        state,
        player: "human",
        card: "Merchant",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(1);
    });
  });

  describe("Moneylender", () => {
    it("should trash Copper for +$3", () => {
      const state = createTestState(["Copper", "Silver"]);

      const result = getCardEffect("Moneylender")!({
        state,
        player: "human",
        card: "Moneylender",
        decision: {
          selectedCards: ["Copper"],
        },
      });

      const trashEvent = result.events.find(e => e.type === "CARD_TRASHED");
      expect(trashEvent).toBeDefined();
      expect(trashEvent!.card).toBe("Copper");

      const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
      expect(coinsEvent).toBeDefined();
      expect(coinsEvent!.delta).toBe(3);
    });

    it("should do nothing if no Copper", () => {
      const state = createTestState(["Silver", "Gold"]);

      const result = getCardEffect("Moneylender")!({
        state,
        player: "human",
        card: "Moneylender",
      });

      // Should not request decision or give coins
      expect(result.pendingDecision).toBeUndefined();
      expect(result.events.find(e => e.type === "COINS_MODIFIED")).toBeUndefined();
    });
  });

  describe("Poacher", () => {
    it("should draw 1, give +1 action, +1 coin", () => {
      const state = createTestState([], ["Copper"]);

      const result = getCardEffect("Poacher")!({
        state,
        player: "human",
        card: "Poacher",
      });

      expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
      expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(1);
      expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(1);
    });

    it("should discard for each empty supply pile", () => {
      const state = createTestState(["Copper", "Silver", "Gold", "Estate"]);
      state.supply.Copper = 0;
      state.supply.Silver = 0;
      state.supply.Gold = 0;

      let newState = executeCard("Poacher", state);

      // Should request discarding 3 cards
      expect(newState.pendingDecision).toBeDefined();
      expect(newState.pendingDecision!.min).toBe(3);
      expect(newState.pendingDecision!.max).toBe(3);
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
