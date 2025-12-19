import { describe, test, expect, beforeEach } from "bun:test";
import { handleCommand } from "./handle";
import { resetEventCounter } from "../events/id-generator";
import type { GameState } from "../types/game-state";
import type { GameCommand } from "./types";

function createMockState(): GameState {
  return {
    players: {
      p1: {
        deck: ["Copper"],
        hand: ["Village"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      p2: {
        deck: ["Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Village: 10,
      Copper: 40,
      Estate: 8,
    },
    kingdomCards: ["Village"],
    playerOrder: ["p1", "p2"],
    turn: 1,
    phase: "action",
    activePlayerId: "p1",
    actions: 1,
    buys: 1,
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

describe("handle - handleCommand", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error for APPROVE_UNDO command", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "APPROVE_UNDO",
      playerId: "p1",
      requestId: "undo_1",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Undo approval handled by engine");
  });

  test("should return error for DENY_UNDO command", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "DENY_UNDO",
      playerId: "p1",
      requestId: "undo_1",
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Undo approval handled by engine");
  });

  test("should validate player turn for regular commands", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "p1",
      card: "Village",
    };

    // Try to execute as wrong player
    const result = handleCommand(state, command, "p2");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your turn");
  });

  test("should allow decision commands from decision player", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
    };

    const command: GameCommand = {
      type: "SKIP_DECISION",
      playerId: "p1",
    };

    // Should allow from decision player even if not active player
    state.activePlayerId = "p2";
    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
  });

  test("should allow reaction commands from defender", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p2",
      triggeringCard: "Witch",
      triggeringPlayerId: "p1",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p2", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.players.p2!.hand = ["Moat"];
    state.players.p3 = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["p1", "p2", "p3"];

    const command: GameCommand = {
      type: "REVEAL_REACTION",
      playerId: "p2",
      card: "Moat",
    };

    // Should allow from defender even though p1 is active
    state.activePlayerId = "p1";
    const result = handleCommand(state, command, "p2");

    expect(result.ok).toBe(true);
  });

  test("should allow undo requests from any player", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "REQUEST_UNDO",
      playerId: "p2",
      toEventId: "evt-1",
    };

    // Should allow from non-active player
    const result = handleCommand(state, command, "p2");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle START_GAME command", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "START_GAME",
      players: ["p1", "p2"],
    };

    const result = handleCommand(state, command);

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle PLAY_ACTION command", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "p1",
      card: "Village",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle PLAY_TREASURE command", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Copper"];
    const command: GameCommand = {
      type: "PLAY_TREASURE",
      playerId: "p1",
      card: "Copper",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle PLAY_ALL_TREASURES command", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Copper"];
    const command: GameCommand = {
      type: "PLAY_ALL_TREASURES",
      playerId: "p1",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
  });

  test("should handle UNPLAY_TREASURE command", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = [];
    state.players.p1!.inPlay = ["Copper"];
    state.coins = 1;
    const command: GameCommand = {
      type: "UNPLAY_TREASURE",
      playerId: "p1",
      card: "Copper",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle BUY_CARD command", () => {
    const state = createMockState();
    state.phase = "buy";
    state.buys = 1;
    state.coins = 3;
    const command: GameCommand = {
      type: "BUY_CARD",
      playerId: "p1",
      card: "Copper",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle END_PHASE command", () => {
    const state = createMockState();
    const command: GameCommand = {
      type: "END_PHASE",
      playerId: "p1",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle SUBMIT_DECISION command", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
    };
    const command: GameCommand = {
      type: "SUBMIT_DECISION",
      playerId: "p1",
      choice: { selectedCards: [] },
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle SKIP_DECISION command", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
    };
    const command: GameCommand = {
      type: "SKIP_DECISION",
      playerId: "p1",
    };

    const result = handleCommand(state, command, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle DECLINE_REACTION command", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p2",
      triggeringCard: "Witch",
      triggeringPlayerId: "p1",
      triggerType: "on_attack",
      availableReactions: [],
      metadata: {
        allTargets: ["p2", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.players.p3 = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["p1", "p2", "p3"];

    const command: GameCommand = {
      type: "DECLINE_REACTION",
      playerId: "p2",
    };

    const result = handleCommand(state, command, "p2");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });
});
