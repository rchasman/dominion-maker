import { describe, it, expect } from "bun:test";
import { executeActionWithEngine } from "./game-agent-helpers";
import { DominionEngine } from "../engine";
import { getLegalActions } from "./legal-actions";
import { KINGDOM_CARDS } from "../data/cards";

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

    expect(result.ok).toBe(true);
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

    expect(result.ok).toBe(true);
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

    expect(result.ok).toBe(true);
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

    expect(result.ok).toBe(true);
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

describe("executeActionWithEngine during a pending play decision", () => {
  function engineWithThroneRoomDecision(): DominionEngine {
    const engine = new DominionEngine();
    engine.startGame(["ai", "human"], KINGDOM_CARDS, 42);
    engine.applyExternalEvents([
      {
        type: "INITIAL_DECK_DEALT",
        playerId: "ai",
        cards: ["Copper", "Copper", "Throne Room", "Bandit", "Estate"],
      },
      {
        type: "INITIAL_HAND_DRAWN",
        playerId: "ai",
        cards: ["Throne Room", "Bandit", "Estate"],
      },
    ]);
    const played = engine.playAction("ai", "Throne Room");
    if (!played.ok) throw new Error(played.error);
    return engine;
  }

  it("offers play_action for the Throne Room target", () => {
    const engine = engineWithThroneRoomDecision();
    expect(getLegalActions(engine.state)).toEqual([
      { type: "play_action", card: "Bandit" },
      { type: "skip_decision" },
    ]);
  });

  it("submits play_action as the decision answer instead of a new play", () => {
    const engine = engineWithThroneRoomDecision();

    const result = executeActionWithEngine(
      engine,
      { type: "play_action", card: "Bandit" },
      "ai",
    );

    expect(result.ok).toBe(true);
    expect(engine.state.pendingChoice).toBeNull();
    expect(engine.state.players.ai!.inPlay).toEqual(["Throne Room", "Bandit"]);
  });
});
