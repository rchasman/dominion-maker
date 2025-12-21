import { describe, it, expect, mock } from "bun:test";
import {
  getLegalActions,
  generateActionViaBackend,
  executeActionWithEngine,
} from "./game-agent-helpers";
import type { GameState } from "../types/game-state";
import { DominionEngine } from "../engine";

describe("getLegalActions", () => {
  describe("reaction choices", () => {
    it("should return reveal and decline actions for reaction", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Moat", "Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
          player2: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "reaction",
          playerId: "player1",
          prompt: "Reveal a reaction?",
          availableReactions: ["Moat"],
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "reveal_reaction", card: "Moat" });
      expect(actions).toContainEqual({ type: "decline_reaction" });
      expect(actions.length).toBe(2);
    });
  });

  describe("decision choices", () => {
    it("should return trash actions for trash stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper", "Estate"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Trash cards",
          min: 0,
          max: 1,
          cardOptions: ["Copper", "Estate"],
          stage: "trash",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "trash_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "trash_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should not include skip when min > 0", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper", "Estate"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Trash exactly 1 card",
          min: 1,
          max: 1,
          cardOptions: ["Copper", "Estate"],
          stage: "trash",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "trash_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "trash_card", card: "Estate" });
      expect(actions).not.toContainEqual({ type: "skip_decision" });
    });

    it("should return discard actions for discard stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper", "Silver"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Discard cards",
          min: 0,
          max: 2,
          cardOptions: ["Copper", "Silver"],
          stage: "discard",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "discard_card", card: "Silver" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should return gain actions for gain stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: { Silver: 10, Estate: 8 },
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Gain a card",
          min: 0,
          max: 1,
          cardOptions: ["Silver", "Estate"],
          stage: "gain",
          from: "supply",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "gain_card", card: "Silver" });
      expect(actions).toContainEqual({ type: "gain_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should return topdeck actions for topdeck stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Topdeck a card",
          min: 0,
          max: 1,
          cardOptions: ["Copper"],
          stage: "topdeck",
          from: "discard",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "topdeck_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should return play_action actions for choose_action stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Village", "Smithy"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Choose an action to play",
          min: 0,
          max: 1,
          cardOptions: ["Village", "Smithy"],
          stage: "choose_action",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "play_action", card: "Village" });
      expect(actions).toContainEqual({ type: "play_action", card: "Smithy" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should handle victim_trash_choice stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper", "Silver"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Trash a treasure",
          min: 1,
          max: 1,
          cardOptions: ["Copper", "Silver"],
          stage: "victim_trash_choice",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "trash_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "trash_card", card: "Silver" });
      expect(actions).not.toContainEqual({ type: "skip_decision" });
    });

    it("should handle opponent_discard stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Discard down to 3",
          min: 1,
          max: 1,
          cardOptions: ["Copper"],
          stage: "opponent_discard",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "discard_card", card: "Copper" });
    });

    it("should handle opponent_topdeck stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Estate"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Topdeck a victory card",
          min: 0,
          max: 1,
          cardOptions: ["Estate"],
          stage: "opponent_topdeck",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "topdeck_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "skip_decision" });
    });

    it("should return empty array for missing player state", () => {
      const state: GameState = {
        players: {},
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Trash cards",
          min: 0,
          max: 1,
          cardOptions: ["Copper"],
          stage: "trash",
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toEqual([]);
    });

    it("should return empty array for unknown stage", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "player1",
          prompt: "Unknown stage",
          min: 0,
          max: 1,
          cardOptions: ["Copper"],
          stage: "unknown_stage" as any,
          from: "hand",
        },
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toEqual([]);
    });
  });

  describe("action phase", () => {
    it("should return playable actions and end_phase", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Village", "Smithy", "Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "play_action", card: "Village" });
      expect(actions).toContainEqual({ type: "play_action", card: "Smithy" });
      expect(actions).toContainEqual({ type: "end_phase" });
      expect(actions).not.toContainEqual({ type: "play_action", card: "Copper" });
    });

    it("should only return end_phase when no actions available", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Village", "Copper"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 0,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toEqual([{ type: "end_phase" }]);
    });
  });

  describe("buy phase", () => {
    it("should return play treasures, buyable cards, and end_phase", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: ["Copper", "Silver"],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "buy",
        actions: 0,
        buys: 1,
        coins: 3,
        supply: {
          Silver: 10,
          Estate: 8,
          Copper: 46,
        },
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toContainEqual({ type: "play_treasure", card: "Copper" });
      expect(actions).toContainEqual({ type: "play_treasure", card: "Silver" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Silver" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Copper" });
      expect(actions).toContainEqual({ type: "end_phase" });
    });

    it("should not include cards that are too expensive", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "buy",
        actions: 0,
        buys: 1,
        coins: 2,
        supply: {
          Silver: 10, // costs 3
          Estate: 8, // costs 2
          Copper: 46, // costs 0
        },
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).not.toContainEqual({ type: "buy_card", card: "Silver" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Copper" });
    });

    it("should not include cards with 0 supply", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "buy",
        actions: 0,
        buys: 1,
        coins: 5,
        supply: {
          Silver: 0, // out of stock
          Estate: 8,
        },
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).not.toContainEqual({ type: "buy_card", card: "Silver" });
      expect(actions).toContainEqual({ type: "buy_card", card: "Estate" });
    });

    it("should not include buyable cards when buys = 0", () => {
      const state: GameState = {
        players: {
          player1: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "buy",
        actions: 0,
        buys: 0,
        coins: 5,
        supply: {
          Silver: 10,
          Estate: 8,
        },
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).not.toContainEqual({ type: "buy_card", card: "Silver" });
      expect(actions).not.toContainEqual({ type: "buy_card", card: "Estate" });
      expect(actions).toContainEqual({ type: "end_phase" });
    });
  });

  describe("missing player state", () => {
    it("should return empty array when active player not in state", () => {
      const state: GameState = {
        players: {
          player2: {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          },
        },
        activePlayerId: "player1",
        turn: 1,
        phase: "action",
        actions: 1,
        buys: 1,
        coins: 0,
        supply: {},
        trash: [],
        log: [],
        gameOver: false,
        winnerId: null,
        turnHistory: [],
        kingdomCards: [],
        pendingChoice: null,
        pendingChoiceEventId: null,
      };

      const actions = getLegalActions(state);

      expect(actions).toEqual([]);
    });
  });
});

describe("generateActionViaBackend", () => {
  it("should call API with correct parameters", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            action: { type: "end_phase" },
          }),
      }),
    );
    global.fetch = mockFetch as any;

    const state: GameState = {
      players: {
        player1: {
          hand: [],
          deck: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      activePlayerId: "player1",
      turn: 1,
      phase: "action",
      actions: 0,
      buys: 1,
      coins: 0,
      supply: {},
      trash: [],
      log: [],
      gameOver: false,
      winnerId: null,
      turnHistory: [],
      kingdomCards: [],
      pendingChoice: null,
      pendingChoiceEventId: null,
    };

    const result = await generateActionViaBackend({
      provider: "gpt-4o-mini",
      currentState: state,
    });

    expect(result.action.type).toBe("end_phase");
  });

  it("should throw error on API failure", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: { value: "API error" } }),
      }),
    );
    global.fetch = mockFetch as any;

    const state: GameState = {
      players: {},
      activePlayerId: "player1",
      turn: 1,
      phase: "action",
      actions: 0,
      buys: 1,
      coins: 0,
      supply: {},
      trash: [],
      log: [],
      gameOver: false,
      winnerId: null,
      turnHistory: [],
      kingdomCards: [],
      pendingChoice: null,
      pendingChoiceEventId: null,
    };

    await expect(
      generateActionViaBackend({
        provider: "gpt-4o-mini",
        currentState: state,
      }),
    ).rejects.toThrow();
  });
});

describe("executeActionWithEngine", () => {
  it("should execute play_action", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);
    engine.state.players["player1"]!.hand = ["Village", "Copper"];
    engine.state.phase = "action";
    engine.state.actions = 1;

    const result = executeActionWithEngine(
      engine,
      { type: "play_action", card: "Village" },
      "player1",
    );

    expect(result).toBe(true);
  });

  it("should execute play_treasure", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);
    engine.state.players["player1"]!.hand = ["Copper"];
    engine.state.phase = "buy";

    const result = executeActionWithEngine(
      engine,
      { type: "play_treasure", card: "Copper" },
      "player1",
    );

    expect(result).toBe(true);
  });

  it("should execute buy_card", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);
    engine.state.phase = "buy";
    engine.state.buys = 1;
    engine.state.coins = 2;

    const result = executeActionWithEngine(
      engine,
      { type: "buy_card", card: "Estate" },
      "player1",
    );

    expect(result).toBe(true);
  });

  it("should execute end_phase", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);
    engine.state.phase = "action";

    const result = executeActionWithEngine(
      engine,
      { type: "end_phase" },
      "player1",
    );

    expect(result).toBe(true);
  });

  it("should throw error for action without required card", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    expect(() =>
      executeActionWithEngine(
        engine,
        { type: "play_action" } as any,
        "player1",
      ),
    ).toThrow("play_action requires card");
  });
});
