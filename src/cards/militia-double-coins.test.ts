/**
 * Test for Militia double coins bug
 * Ensures that +2 Coins is only applied once, not duplicated
 * for each opponent decision.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { GameState } from "../types/game-state";
import { handleCommand } from "../commands/handle";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";

function createTestState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: ["Militia"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"], // 5 cards, needs to discard 2
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate"], // 4 cards, needs to discard 1
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
      Militia: 10,
    },
    activePlayerId: "human",
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    playerOrder: ["human", "ai1", "ai2"],
    turnNumber: 1,
    trash: [],
    turnHistory: [],
    log: [],
  };
}

describe("Militia Double Coins Bug", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should only emit COINS_MODIFIED once when playing Militia", () => {
    const state = createTestState();

    // Play Militia
    const playResult = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

    // Count COINS_MODIFIED events - should be exactly 1
    const coinsEvents = playResult.events.filter(
      e => e.type === "COINS_MODIFIED",
    );
    expect(coinsEvents.length).toBe(1);
    expect(coinsEvents[0]?.delta).toBe(2);

    // Apply events and verify coins
    const newState = applyEvents(state, playResult.events);
    expect(newState.coins).toBe(2); // Should be 2, not 4
  });

  it("should not duplicate COINS_MODIFIED when processing opponent decisions", () => {
    const state = createTestState();

    // Play Militia
    const playResult = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

    // Count initial coins
    const initialCoinsEvents = playResult.events.filter(
      e => e.type === "COINS_MODIFIED",
    );
    expect(initialCoinsEvents.length).toBe(1);

    // Apply and get state for first opponent decision
    let currentState = applyEvents(state, playResult.events);
    expect(currentState.coins).toBe(2);

    // ai1 discards 2 cards
    const discard1Result = handleCommand(
      currentState,
      {
        type: "SUBMIT_DECISION",
        playerId: "ai1",
        choice: {
          selectedCards: ["Copper", "Silver"],
        },
      },
      "ai1",
    );

    if (!discard1Result.ok) {
      console.log("Discard1 error:", discard1Result.error);
      console.log("Pending choice:", currentState.pendingChoice);
    }
    expect(discard1Result.ok).toBe(true);
    if (!discard1Result.ok)
      throw new Error(`Discard1 failed: ${discard1Result.error}`);

    // Should NOT have any COINS_MODIFIED events in opponent decision
    const coinsEventsInDiscard1 = discard1Result.events.filter(
      e => e.type === "COINS_MODIFIED",
    );
    expect(coinsEventsInDiscard1.length).toBe(0);

    // Apply and verify coins haven't changed
    currentState = applyEvents(currentState, discard1Result.events);
    expect(currentState.coins).toBe(2); // Still 2, not 4

    // ai2 discards 1 card
    const discard2Result = handleCommand(
      currentState,
      {
        type: "SUBMIT_DECISION",
        playerId: "ai2",
        choice: {
          selectedCards: ["Copper"],
        },
      },
      "ai2",
    );

    expect(discard2Result.ok).toBe(true);
    if (!discard2Result.ok)
      throw new Error(`Discard2 failed: ${discard2Result.error}`);

    // Should NOT have any COINS_MODIFIED events
    const coinsEventsInDiscard2 = discard2Result.events.filter(
      e => e.type === "COINS_MODIFIED",
    );
    expect(coinsEventsInDiscard2.length).toBe(0);

    // Apply and verify final coins
    currentState = applyEvents(currentState, discard2Result.events);
    expect(currentState.coins).toBe(2); // Still 2, never duplicated
  });

  it("should give exactly +2 coins total across entire Militia resolution", () => {
    const state = createTestState();
    let currentState = state;

    // Track all coins modifications
    const allCoinsEvents: Array<{ delta: number }> = [];

    // Play Militia
    const playResult = handleCommand(
      currentState,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

    allCoinsEvents.push(
      ...playResult.events
        .filter((e): e is { type: "COINS_MODIFIED"; delta: number } =>
          e.type === "COINS_MODIFIED",
        )
        .map(e => ({ delta: e.delta })),
    );

    currentState = applyEvents(currentState, playResult.events);

    // ai1 discards 2 cards
    const discard1Result = handleCommand(
      currentState,
      {
        type: "SUBMIT_DECISION",
        playerId: "ai1",
        choice: {
          selectedCards: ["Copper", "Silver"],
        },
      },
      "ai1",
    );

    if (!discard1Result.ok) {
      console.log("Discard1 error:", discard1Result.error);
      console.log("Pending choice:", currentState.pendingChoice);
    }
    expect(discard1Result.ok).toBe(true);
    if (!discard1Result.ok)
      throw new Error(`Discard1 failed: ${discard1Result.error}`);

    allCoinsEvents.push(
      ...discard1Result.events
        .filter((e): e is { type: "COINS_MODIFIED"; delta: number } =>
          e.type === "COINS_MODIFIED",
        )
        .map(e => ({ delta: e.delta })),
    );

    currentState = applyEvents(currentState, discard1Result.events);

    // ai2 discards 1 card
    const discard2Result = handleCommand(
      currentState,
      {
        type: "SUBMIT_DECISION",
        playerId: "ai2",
        choice: {
          selectedCards: ["Copper"],
        },
      },
      "ai2",
    );

    expect(discard2Result.ok).toBe(true);
    if (!discard2Result.ok)
      throw new Error(`Discard2 failed: ${discard2Result.error}`);

    allCoinsEvents.push(
      ...discard2Result.events
        .filter((e): e is { type: "COINS_MODIFIED"; delta: number } =>
          e.type === "COINS_MODIFIED",
        )
        .map(e => ({ delta: e.delta })),
    );

    currentState = applyEvents(currentState, discard2Result.events);

    // Total coins modifications should be exactly 1 event with delta +2
    expect(allCoinsEvents.length).toBe(1);
    expect(allCoinsEvents[0]?.delta).toBe(2);

    // Final coins should be exactly 2
    expect(currentState.coins).toBe(2);
  });
});
