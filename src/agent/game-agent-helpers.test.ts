import { describe, it, expect, mock } from "bun:test";
import {
  generateActionViaBackend,
  executeActionWithEngine,
} from "./game-agent-helpers";
import type { GameState } from "../types/game-state";
import { DominionEngine } from "../engine";

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
      supply: {} as Record<string, number>,
      trash: [],
      log: [],
      gameOver: false,
      winnerId: null,
      turnHistory: [],
      kingdomCards: [],
      pendingChoice: null,
      pendingChoiceEventId: null,
      activeEffects: [],
      playerOrder: ["player1", "player2"],
    };

    const result = await generateActionViaBackend({
      provider: "gpt-5.4-mini",
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
      supply: {} as Record<string, number>,
      trash: [],
      log: [],
      gameOver: false,
      winnerId: null,
      turnHistory: [],
      kingdomCards: [],
      pendingChoice: null,
      pendingChoiceEventId: null,
      activeEffects: [],
      playerOrder: ["player1", "player2"],
    };

    await expect(
      generateActionViaBackend({
        provider: "gpt-5.4-mini",
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
