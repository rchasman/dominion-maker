import { describe, it, expect, beforeEach } from "bun:test";
import { handleCommand } from "./handle";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";
import type { GameState, CardName } from "../types/game-state";
import type { GameCommand } from "./types";

/**
 * Comprehensive command system tests
 * Ensures commands work correctly and don't break core game mechanics
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
    activeEffects: [],
  };
}

describe("Command System - START_GAME", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should start a game with valid players", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");
    expect(result.events.length).toBeGreaterThan(0);

    // Should have GAME_INITIALIZED event
    const gameInit = result.events.find((e: GameEvent) => e.type === "GAME_INITIALIZED");
    expect(gameInit).toBeDefined();
    if (!gameInit) throw new Error("Expected GAME_INITIALIZED event");
    expect(gameInit.players).toEqual(["human", "ai"]);
  });

  it("should initialize supply with correct counts", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    if (!result.events) throw new Error("Expected events");
    const gameInit = result.events.find((e: GameEvent) => e.type === "GAME_INITIALIZED");

    expect(gameInit).toBeDefined();
    if (!gameInit) throw new Error("Expected GAME_INITIALIZED event");

    // 2-player game supply counts
    expect(gameInit.supply.Estate).toBe(8);
    expect(gameInit.supply.Duchy).toBe(8);
    expect(gameInit.supply.Province).toBe(8);
    expect(gameInit.supply.Copper).toBe(60 - 2 * 7); // 46
    expect(gameInit.supply.Silver).toBe(40);
    expect(gameInit.supply.Gold).toBe(30);
    expect(gameInit.supply.Curse).toBe(10); // (2-1)*10
  });

  it("should deal initial decks to all players", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    if (!result.events) throw new Error("Expected events");
    const deckEvents = result.events.filter(
      e => e.type === "INITIAL_DECK_DEALT",
    );

    expect(deckEvents.length).toBe(2);
    expect(deckEvents[0].playerId).toBe("human");
    expect(deckEvents[0].cards.length).toBe(10); // 7 Copper + 3 Estate
    expect(deckEvents[1].playerId).toBe("ai");
    expect(deckEvents[1].cards.length).toBe(10);
  });

  it("should draw initial hands for all players", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    if (!result.events) throw new Error("Expected events");
    const handEvents = result.events.filter(
      e => e.type === "INITIAL_HAND_DRAWN",
    );

    expect(handEvents.length).toBe(2);
    expect(handEvents[0].cards.length).toBe(5);
    expect(handEvents[1].cards.length).toBe(5);
  });

  it("should start turn 1 with initial resources", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    if (!result.events) throw new Error("Expected events");

    // Should have turn start
    const turnStart = result.events.find((e: GameEvent) => e.type === "TURN_STARTED");
    expect(turnStart).toBeDefined();
    if (!turnStart) throw new Error("Expected TURN_STARTED event");
    expect(turnStart.turn).toBe(1);
    expect(turnStart.playerId).toBe("human");

    // Should have initial resources
    const actionsModified = result.events.filter(
      e => e.type === "ACTIONS_MODIFIED",
    );
    const buysModified = result.events.filter((e: GameEvent) => e.type === "BUYS_MODIFIED");

    expect(actionsModified.length).toBeGreaterThan(0);
    expect(buysModified.length).toBeGreaterThan(0);
  });
});

describe("Command System - PLAY_ACTION", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  function createGameWithCardsInHand(cards: CardName[]): GameState {
    return {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: cards,
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "action",
      actions: 1,
      buys: 1,
      coins: 0,
    };
  }

  it("should play a simple action card (Village)", () => {
    const state = createGameWithCardsInHand(["Village", "Copper"]);
    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    // Should have CARD_PLAYED event
    const cardPlayed = result.events.find((e: GameEvent) => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();
    if (!cardPlayed) throw new Error("Expected CARD_PLAYED event");
    expect(cardPlayed.card).toBe("Village");

    // Should deduct action cost
    const actionCost = result.events.find(
      e => e.type === "ACTIONS_MODIFIED" && e.delta === -1,
    );
    expect(actionCost).toBeDefined();

    // Village gives +1 card, +2 actions
    const actionBonus = result.events.find(
      e => e.type === "ACTIONS_MODIFIED" && e.delta === 2,
    );
    expect(actionBonus).toBeDefined();
  });

  it("should fail if not in action phase", () => {
    const state = createGameWithCardsInHand(["Village"]);
    state.phase = "buy";

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("action phase");
  });

  it("should fail if no actions available", () => {
    const state = createGameWithCardsInHand(["Village"]);
    state.actions = 0;

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No actions");
  });

  it("should fail if card not in hand", () => {
    const state = createGameWithCardsInHand(["Copper"]);

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not in hand");
  });

  it("should fail if card is not an action", () => {
    const state = createGameWithCardsInHand(["Copper"]);

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("action card");
  });
});

describe("Command System - PLAY_TREASURE", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  function createBuyPhaseState(treasures: CardName[]): GameState {
    return {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: treasures,
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 0,
    };
  }

  it("should play a treasure card (Copper)", () => {
    const state = createBuyPhaseState(["Copper"]);
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const cardPlayed = result.events.find((e: GameEvent) => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();

    const coinsAdded = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === 1,
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should play Silver for 2 coins", () => {
    const state = createBuyPhaseState(["Silver"]);
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const coinsAdded = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === 2,
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should play Gold for 3 coins", () => {
    const state = createBuyPhaseState(["Gold"]);
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Gold",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const coinsAdded = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === 3,
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should fail if not in buy phase", () => {
    const state = createBuyPhaseState(["Copper"]);
    state.phase = "action";

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("buy phase");
  });

  it("should handle Merchant bonus on first Silver", () => {
    const state = createBuyPhaseState(["Silver"]);
    state.players.human!.inPlay = ["Merchant"];

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    // Should have 2 coins from Silver + 1 from Merchant bonus
    const coinEvents = result.events.filter((e: GameEvent) => e.type === "COINS_MODIFIED");
    const totalCoins = coinEvents.reduce((sum: number, e: GameEvent) => sum + e.delta, 0);
    expect(totalCoins).toBe(3); // 2 + 1
  });
});

describe("Command System - BUY_CARD", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  function createBuyState(buys: number, coins: number): GameState {
    return {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      supply: {
        Copper: 46,
        Silver: 40,
        Gold: 30,
        Estate: 8,
        Duchy: 8,
        Province: 8,
        Village: 10,
        Smithy: 10,
      },
      activePlayerId: "human",
      phase: "buy",
      actions: 0,
      buys,
      coins,
    };
  }

  it("should buy a card with sufficient buys and coins", () => {
    const state = createBuyState(1, 5);
    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const cardGained = result.events.find((e: GameEvent) => e.type === "CARD_GAINED");
    expect(cardGained).toBeDefined();
    if (!cardGained) throw new Error("Expected CARD_GAINED event");
    expect(cardGained.card).toBe("Silver");
    expect(cardGained.to).toBe("discard");

    const buysModified = result.events.find(
      e => e.type === "BUYS_MODIFIED" && e.delta === -1,
    );
    expect(buysModified).toBeDefined();

    const coinsModified = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === -3,
    );
    expect(coinsModified).toBeDefined();
  });

  it("should fail if no buys available", () => {
    const state = createBuyState(0, 10);
    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No buys");
  });

  it("should fail if insufficient coins", () => {
    const state = createBuyState(1, 2);
    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not enough");
  });

  it("should fail if card not in supply", () => {
    const state = createBuyState(1, 10);
    state.supply = {};

    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not available");
  });

  it("should buy expensive card (Province for 8)", () => {
    const state = createBuyState(1, 8);
    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "human",
      card: "Province",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const coinsModified = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === -8,
    );
    expect(coinsModified).toBeDefined();
  });
});

describe("Command System - END_PHASE", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should transition from action to buy phase", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: ["Copper", "Copper", "Copper"],
          hand: ["Estate"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "action",
      actions: 1,
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "END_PHASE",
      playerId: "human",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const phaseChanged = result.events.find((e: GameEvent) => e.type === "PHASE_CHANGED");
    expect(phaseChanged).toBeDefined();
    if (!phaseChanged) throw new Error("Expected PHASE_CHANGED event");
    expect(phaseChanged.phase).toBe("buy");
  });

  it("should end turn and start next player's turn from buy phase", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: ["Copper", "Estate", "Copper", "Silver"],
          hand: ["Estate"],
          discard: ["Copper"],
          inPlay: ["Copper"],
          inPlaySourceIndices: [0],
        },
        ai: {
          deck: ["Copper", "Copper", "Copper", "Estate", "Estate"],
          hand: ["Estate", "Copper"],
          discard: [],
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
        Village: 10,
      },
      playerOrder: ["human", "ai"],
      turn: 1,
      activePlayerId: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 1,
    };

    const command: GameCommand = {
      type: "END_PHASE",
      playerId: "human",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");
    expect(result.events.length).toBeGreaterThan(0);

    // Should have turn ended event
    const turnEnded = result.events.find((e: GameEvent) => e.type === "TURN_ENDED");
    expect(turnEnded).toBeDefined();
    if (!turnEnded) throw new Error("Expected TURN_ENDED event");
    expect(turnEnded.playerId).toBe("human");
    expect(turnEnded.turn).toBe(1);

    // Should have turn started event for next player
    const turnStarted = result.events.find((e: GameEvent) => e.type === "TURN_STARTED");
    expect(turnStarted).toBeDefined();
    if (!turnStarted) throw new Error("Expected TURN_STARTED event");
    expect(turnStarted.turn).toBe(2);
    expect(turnStarted.playerId).toBe("ai");

    // Should have discarded hand and in-play cards
    const discarded = result.events.filter((e: GameEvent) => e.type === "CARD_DISCARDED");
    expect(discarded.length).toBeGreaterThanOrEqual(2); // hand + in-play

    // Should have resource initialization for new turn
    const actionsModified = result.events.filter(
      e => e.type === "ACTIONS_MODIFIED",
    );
    const buysModified = result.events.filter((e: GameEvent) => e.type === "BUYS_MODIFIED");
    expect(actionsModified.length).toBeGreaterThan(0);
    expect(buysModified.length).toBeGreaterThan(0);
  });
});

describe("Command System - UNPLAY_TREASURE", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should unplay a treasure card", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: ["Copper"],
          inPlaySourceIndices: [0],
        },
      },
      activePlayerId: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 1,
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const returnedToHand = result.events.find(
      e => e.type === "CARD_RETURNED_TO_HAND",
    );
    expect(returnedToHand).toBeDefined();
    if (!returnedToHand)
      throw new Error("Expected CARD_RETURNED_TO_HAND event");
    expect(returnedToHand.card).toBe("Copper");

    const coinsRemoved = result.events.find(
      e => e.type === "COINS_MODIFIED" && e.delta === -1,
    );
    expect(coinsRemoved).toBeDefined();
  });

  it("should remove Merchant bonus when unplaying Silver", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: ["Merchant", "Silver"],
          inPlaySourceIndices: [0, 1],
        },
      },
      activePlayerId: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 3, // 2 from Silver + 1 from Merchant
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    // Should remove 2 coins from Silver + 1 from Merchant = -3 total
    const coinsModifiedEvents = result.events.filter(
      e => e.type === "COINS_MODIFIED",
    );
    expect(coinsModifiedEvents.length).toBeGreaterThan(0);
    const totalCoinsRemoved = coinsModifiedEvents.reduce(
      (sum, e) => sum + e.delta,
      0,
    );
    expect(totalCoinsRemoved).toBe(-3);
  });

  it("should fail if treasure not in play", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: ["Copper"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "buy",
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not in play");
  });

  it("should fail if purchases already made", () => {
    let state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: ["Copper"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      supply: {
        Copper: 60,
      },
      activePlayerId: "human",
      phase: "buy",
      buys: 1,
      coins: 0,
    };

    // Play Copper
    const playResult = handleCommand(state, {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    });
    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error("Expected successful play");
    state = applyEvents(state, playResult.events);

    // Buy a card
    const buyResult = handleCommand(state, {
      type: "BUY_CARD",
      playerId: "human",
      card: "Copper",
    });
    expect(buyResult.ok).toBe(true);
    if (!buyResult.ok) throw new Error("Expected successful buy");
    state = applyEvents(state, buyResult.events);

    // Try to unplay - should fail
    const unplayResult = handleCommand(state, {
      type: "UNPLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    });

    expect(unplayResult.ok).toBe(false);
    expect(unplayResult.error).toContain("already made purchases");
  });

  it("should allow unplaying before any purchases", () => {
    let state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: ["Silver"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "buy",
      buys: 1,
      coins: 0,
    };

    // Play Silver
    const playResult = handleCommand(state, {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    });
    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error("Expected successful play");
    state = applyEvents(state, playResult.events);
    expect(state.coins).toBe(2);

    // Unplay before buying - should work
    const unplayResult = handleCommand(state, {
      type: "UNPLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    });

    expect(unplayResult.ok).toBe(true);
    if (!unplayResult.ok) throw new Error("Expected successful unplay");
    state = applyEvents(state, unplayResult.events);
    expect(state.coins).toBe(0);
    expect(state.players.human!.hand).toContain("Silver");
  });
});

describe("Command System - Event Causality", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should link all card effect events to card played event", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: ["Copper", "Estate"],
          hand: ["Market"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "action",
      actions: 1,
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Market",
    };

    const result = handleCommand(state, command);
    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    // Find the root CARD_PLAYED event
    const cardPlayed = result.events.find((e: GameEvent) => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();
    if (!cardPlayed) throw new Error("Expected CARD_PLAYED event");
    expect(cardPlayed.id).toBeDefined();

    // All effect events should be caused by the card played
    const effectEvents = result.events.filter(
      e =>
        e.type === "ACTIONS_MODIFIED" ||
        e.type === "BUYS_MODIFIED" ||
        e.type === "COINS_MODIFIED" ||
        e.type === "CARDS_DRAWN",
    );

    for (const event of effectEvents) {
      expect(event.causedBy).toBeDefined();
      // Should be caused by either root or another effect
      expect(event.causedBy).toBeTruthy();
    }
  });

  it("should maintain causality for treasure plays", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: ["Silver"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "buy",
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);
    expect(result.ok).toBe(true);
    if (!result.events) throw new Error("Expected events");

    const cardPlayed = result.events.find((e: GameEvent) => e.type === "CARD_PLAYED");
    const coinsModified = result.events.find((e: GameEvent) => e.type === "COINS_MODIFIED");

    if (!cardPlayed) throw new Error("Expected CARD_PLAYED event");
    if (!coinsModified) throw new Error("Expected COINS_MODIFIED event");
    expect(cardPlayed.id).toBeDefined();
    expect(coinsModified.causedBy).toBe(cardPlayed.id);
  });
});

describe("Command System - Player Validation", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should reject command from wrong player during action phase", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: ["Village"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
        ai: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      playerOrder: ["human", "ai"],
      activePlayerId: "human",
      phase: "action",
      actions: 1,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "ai", // Wrong player!
      card: "Village",
    };

    const result = handleCommand(state, command, "ai");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your turn");
  });

  it("should allow active player to execute commands", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: ["Copper", "Estate"],
          hand: ["Village"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "action",
      actions: 1,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    };

    const result = handleCommand(state, command, "human");

    expect(result.ok).toBe(true);
  });
});

describe("Command System - Cellar Causality", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should link Cellar discard/draw events to CARD_PLAYED event", () => {
    const state: GameState = {
      ...createEmptyState(),
      players: {
        human: {
          deck: ["Gold", "Gold"],
          hand: ["Cellar", "Estate", "Copper"],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "human",
      phase: "action",
      actions: 1,
    };

    // Play Cellar - should create CARD_PLAYED and DECISION_REQUIRED
    const playResult = handleCommand(state, {
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Cellar",
    });

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error("Expected ok result");

    const cardPlayedEvent = playResult.events.find(
      e => e.type === "CARD_PLAYED",
    );
    expect(cardPlayedEvent).toBeDefined();
    if (!cardPlayedEvent) throw new Error("Expected CARD_PLAYED event");

    const rootEventId = cardPlayedEvent.id;

    // Apply events to get updated state
    let midState = applyEvents(state, playResult.events);
    expect(midState.pendingChoice).toBeDefined();
    console.log(
      "pendingChoice:",
      JSON.stringify(midState.pendingChoice, null, 2),
    );

    // Batch discard: Estate (just 1 card)
    const decision1Result = handleCommand(midState, {
      type: "SUBMIT_DECISION",
      playerId: "human",
      choice: {
        selectedCards: ["Estate"],
      },
    });

    if (!decision1Result.ok) {
      console.log("Decision failed:", decision1Result.error);
    }
    expect(decision1Result.ok).toBe(true);

    // Cellar now processes batch and auto-draws in one decision
    const discardEvents = decision1Result.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
    const drawEvents = decision1Result.events.filter(
      e => e.type === "CARD_DRAWN",
    );

    expect(discardEvents.length).toBe(1); // Discarded 1
    expect(drawEvents.length).toBe(1); // Drew 1

    // Verify all discard/draw events are linked to the original CARD_PLAYED event
    for (const event of [...discardEvents, ...drawEvents]) {
      expect(event.causedBy).toBe(rootEventId);
    }

    // No pending decision after batch
    midState = applyEvents(midState, decision1Result.events);
    expect(midState.pendingChoice).toBeNull();
  });
});
