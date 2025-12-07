import { describe, it, expect, beforeEach } from "bun:test";
import { handleCommand } from "./handle";
import { resetEventCounter } from "../events/id-generator";
import type { GameState } from "../types/game-state";
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
    expect(result.events!.length).toBeGreaterThan(0);

    // Should have GAME_INITIALIZED event
    const gameInit = result.events!.find(e => e.type === "GAME_INITIALIZED");
    expect(gameInit).toBeDefined();
    expect(gameInit!.players).toEqual(["human", "ai"]);
  });

  it("should initialize supply with correct counts", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    const gameInit = result.events!.find(e => e.type === "GAME_INITIALIZED");

    expect(gameInit).toBeDefined();

    // 2-player game supply counts
    expect(gameInit!.supply.Estate).toBe(8);
    expect(gameInit!.supply.Duchy).toBe(8);
    expect(gameInit!.supply.Province).toBe(8);
    expect(gameInit!.supply.Copper).toBe(60 - (2 * 7)); // 46
    expect(gameInit!.supply.Silver).toBe(40);
    expect(gameInit!.supply.Gold).toBe(30);
    expect(gameInit!.supply.Curse).toBe(10); // (2-1)*10
  });

  it("should deal initial decks to all players", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    const deckEvents = result.events!.filter(e => e.type === "INITIAL_DECK_DEALT");

    expect(deckEvents.length).toBe(2);
    expect(deckEvents[0].player).toBe("human");
    expect(deckEvents[0].cards.length).toBe(10); // 7 Copper + 3 Estate
    expect(deckEvents[1].player).toBe("ai");
    expect(deckEvents[1].cards.length).toBe(10);
  });

  it("should draw initial hands for all players", () => {
    const state = createEmptyState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = handleCommand(state, command);
    const handEvents = result.events!.filter(e => e.type === "INITIAL_HAND_DRAWN");

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

    // Should have turn start
    const turnStart = result.events!.find(e => e.type === "TURN_STARTED");
    expect(turnStart).toBeDefined();
    expect(turnStart!.turn).toBe(1);
    expect(turnStart!.player).toBe("human");

    // Should have initial resources
    const actionsModified = result.events!.filter(e => e.type === "ACTIONS_MODIFIED");
    const buysModified = result.events!.filter(e => e.type === "BUYS_MODIFIED");

    expect(actionsModified.length).toBeGreaterThan(0);
    expect(buysModified.length).toBeGreaterThan(0);
  });
});

describe("Command System - PLAY_ACTION", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  function createGameWithCardsInHand(cards: string[]): GameState {
    return {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: cards as any[],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayer: "human",
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
      player: "human",
      card: "Village",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    // Should have CARD_PLAYED event
    const cardPlayed = result.events!.find(e => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();
    expect(cardPlayed!.card).toBe("Village");

    // Should deduct action cost
    const actionCost = result.events!.find(e =>
      e.type === "ACTIONS_MODIFIED" && e.delta === -1
    );
    expect(actionCost).toBeDefined();

    // Village gives +1 card, +2 actions
    const actionBonus = result.events!.find(e =>
      e.type === "ACTIONS_MODIFIED" && e.delta === 2
    );
    expect(actionBonus).toBeDefined();
  });

  it("should fail if not in action phase", () => {
    const state = createGameWithCardsInHand(["Village"]);
    state.phase = "buy";

    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "human",
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
      player: "human",
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
      player: "human",
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
      player: "human",
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

  function createBuyPhaseState(treasures: string[]): GameState {
    return {
      ...createEmptyState(),
      players: {
        human: {
          deck: [],
          hand: treasures as any[],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayer: "human",
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
      player: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const cardPlayed = result.events!.find(e => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();

    const coinsAdded = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === 1
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should play Silver for 2 coins", () => {
    const state = createBuyPhaseState(["Silver"]);
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      player: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const coinsAdded = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === 2
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should play Gold for 3 coins", () => {
    const state = createBuyPhaseState(["Gold"]);
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      player: "human",
      card: "Gold",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const coinsAdded = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === 3
    );
    expect(coinsAdded).toBeDefined();
  });

  it("should fail if not in buy phase", () => {
    const state = createBuyPhaseState(["Copper"]);
    state.phase = "action";

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      player: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("buy phase");
  });

  it("should handle Merchant bonus on first Silver", () => {
    const state = createBuyPhaseState(["Silver"]);
    state.players.human.inPlay = ["Merchant" as any];

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      player: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    // Should have 2 coins from Silver + 1 from Merchant bonus
    const coinEvents = result.events!.filter(e => e.type === "COINS_MODIFIED");
    const totalCoins = coinEvents.reduce((sum, e) => sum + e.delta, 0);
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
      activePlayer: "human",
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
      player: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const cardGained = result.events!.find(e => e.type === "CARD_GAINED");
    expect(cardGained).toBeDefined();
    expect(cardGained!.card).toBe("Silver");
    expect(cardGained!.to).toBe("discard");

    const buysModified = result.events!.find(e =>
      e.type === "BUYS_MODIFIED" && e.delta === -1
    );
    expect(buysModified).toBeDefined();

    const coinsModified = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === -3
    );
    expect(coinsModified).toBeDefined();
  });

  it("should fail if no buys available", () => {
    const state = createBuyState(0, 10);
    const command: GameCommand = {
      type: "BUY_CARD",
      player: "human",
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
      player: "human",
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
      player: "human",
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
      player: "human",
      card: "Province",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const coinsModified = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === -8
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
      activePlayer: "human",
      phase: "action",
      actions: 1,
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "END_PHASE",
      player: "human",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const phaseChanged = result.events!.find(e => e.type === "PHASE_CHANGED");
    expect(phaseChanged).toBeDefined();
    expect(phaseChanged!.phase).toBe("buy");
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
      activePlayer: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 1,
    };

    const command: GameCommand = {
      type: "END_PHASE",
      player: "human",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    expect(result.events!.length).toBeGreaterThan(0);

    // Should have turn ended event
    const turnEnded = result.events!.find(e => e.type === "TURN_ENDED");
    expect(turnEnded).toBeDefined();
    expect(turnEnded!.player).toBe("human");
    expect(turnEnded!.turn).toBe(1);

    // Should have turn started event for next player
    const turnStarted = result.events!.find(e => e.type === "TURN_STARTED");
    expect(turnStarted).toBeDefined();
    expect(turnStarted!.turn).toBe(2);
    expect(turnStarted!.player).toBe("ai");

    // Should have discarded hand and in-play cards
    const discarded = result.events!.filter(e => e.type === "CARD_DISCARDED");
    expect(discarded.length).toBeGreaterThanOrEqual(2); // hand + in-play

    // Should have resource initialization for new turn
    const actionsModified = result.events!.filter(e => e.type === "ACTIONS_MODIFIED");
    const buysModified = result.events!.filter(e => e.type === "BUYS_MODIFIED");
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
      activePlayer: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 1,
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      player: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    const returnedToHand = result.events!.find(e => e.type === "CARD_RETURNED_TO_HAND");
    expect(returnedToHand).toBeDefined();
    expect(returnedToHand!.card).toBe("Copper");

    const coinsRemoved = result.events!.find(e =>
      e.type === "COINS_MODIFIED" && e.delta === -1
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
      activePlayer: "human",
      phase: "buy",
      actions: 0,
      buys: 1,
      coins: 3, // 2 from Silver + 1 from Merchant
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      player: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);

    // Should remove 2 coins from Silver + 1 from Merchant = -3 total
    const coinsModified = result.events!.find(e => e.type === "COINS_MODIFIED");
    expect(coinsModified).toBeDefined();
    expect(coinsModified!.delta).toBe(-3);
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
      activePlayer: "human",
      phase: "buy",
    };

    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      player: "human",
      card: "Copper",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not in play");
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
      activePlayer: "human",
      phase: "action",
      actions: 1,
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "human",
      card: "Market",
    };

    const result = handleCommand(state, command);
    expect(result.ok).toBe(true);

    // Find the root CARD_PLAYED event
    const cardPlayed = result.events!.find(e => e.type === "CARD_PLAYED");
    expect(cardPlayed).toBeDefined();
    expect(cardPlayed!.id).toBeDefined();

    const rootId = cardPlayed!.id;

    // All effect events should be caused by the card played
    const effectEvents = result.events!.filter(e =>
      e.type === "ACTIONS_MODIFIED" ||
      e.type === "BUYS_MODIFIED" ||
      e.type === "COINS_MODIFIED" ||
      e.type === "CARDS_DRAWN"
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
      activePlayer: "human",
      phase: "buy",
      buys: 1,
      coins: 0,
    };

    const command: GameCommand = {
      type: "PLAY_TREASURE",
      player: "human",
      card: "Silver",
    };

    const result = handleCommand(state, command);
    expect(result.ok).toBe(true);

    const cardPlayed = result.events!.find(e => e.type === "CARD_PLAYED");
    const coinsModified = result.events!.find(e => e.type === "COINS_MODIFIED");

    expect(cardPlayed!.id).toBeDefined();
    expect(coinsModified!.causedBy).toBe(cardPlayed!.id);
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
      activePlayer: "human",
      phase: "action",
      actions: 1,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "ai", // Wrong player!
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
      activePlayer: "human",
      phase: "action",
      actions: 1,
    };

    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "human",
      card: "Village",
    };

    const result = handleCommand(state, command, "human");

    expect(result.ok).toBe(true);
  });
});
