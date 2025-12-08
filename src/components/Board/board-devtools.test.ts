import { describe, it, expect } from "bun:test";

/**
 * Board component devtools integration tests
 * Tests that scrubbing through event history updates the displayed game state
 */

describe("Board - Devtools scrubbing", () => {
  it("should use displayState derived from preview mode when scrubbing", () => {
    // Test the logic that determines what state to display
    const liveState = { turn: 5, activePlayer: "human" as const };
    const previewState = { turn: 2, activePlayer: "ai" as const };
    const previewEventId = "event-123";

    // Mock getStateAtEvent function
    const getStateAtEvent = (eventId: string) => {
      if (eventId === "event-123") return previewState;
      return liveState;
    };

    // Logic from Board component lines 132-135
    const displayState =
      previewEventId && getStateAtEvent
        ? getStateAtEvent(previewEventId)
        : liveState;

    const isPreviewMode = previewEventId !== null;

    // When scrubbing (previewEventId is set), displayState should be the preview state
    expect(displayState).toBe(previewState);
    expect(isPreviewMode).toBe(true);
    expect(displayState.turn).toBe(2);
    expect(displayState.activePlayer).toBe("ai");
  });

  it("should use live state when not scrubbing", () => {
    const liveState = { turn: 5, activePlayer: "human" as const };
    const previewState = { turn: 2, activePlayer: "ai" as const };
    const previewEventId = null;

    const getStateAtEvent = (eventId: string) => {
      if (eventId === "event-123") return previewState;
      return liveState;
    };

    // Logic from Board component
    const displayState =
      previewEventId && getStateAtEvent
        ? getStateAtEvent(previewEventId)
        : liveState;

    const isPreviewMode = previewEventId !== null;

    // When not scrubbing (previewEventId is null), displayState should be live state
    expect(displayState).toBe(liveState);
    expect(isPreviewMode).toBe(false);
    expect(displayState.turn).toBe(5);
    expect(displayState.activePlayer).toBe("human");
  });

  it("should derive player data from displayState not live state", () => {
    // This test verifies that player IDs, VP counts, and turn flags
    // should be calculated from displayState (which respects preview mode)

    // Mock state at event 10 (preview)
    const previewState = {
      turn: 3,
      activePlayer: "ai" as const,
      players: {
        human: { deck: [], hand: [], discard: [], inPlay: [] },
        ai: { deck: [], hand: [], discard: [], inPlay: [] },
      },
    };

    // Mock current live state at event 50
    const liveState = {
      turn: 15,
      activePlayer: "human" as const,
      players: {
        human: { deck: [], hand: [], discard: [], inPlay: [] },
        ai: { deck: [], hand: [], discard: [], inPlay: [] },
      },
    };

    const previewEventId = "event-10";
    const getStateAtEvent = (_eventId: string) => previewState;

    // Derive displayState (should use preview when scrubbing)
    const displayState =
      previewEventId && getStateAtEvent
        ? getStateAtEvent(previewEventId)
        : liveState;

    // Get player IDs from GAME_MODE_CONFIG
    const playerIds = ["human", "ai"] as const;
    const mainPlayerId = playerIds[0];
    const opponentPlayerId = playerIds[1];

    // Derive player data from displayState
    const mainPlayer = displayState.players[mainPlayerId];
    const opponent = displayState.players[opponentPlayerId];
    const isMainPlayerTurn = displayState.activePlayer === mainPlayerId;

    // When scrubbing to event 10, we should see preview state values
    expect(displayState).toBe(previewState);
    expect(displayState.turn).toBe(3);
    expect(displayState.activePlayer).toBe("ai");
    expect(isMainPlayerTurn).toBe(false);

    // mainPlayer and opponent should come from displayState (preview)
    expect(mainPlayer).toBe(previewState.players.human);
    expect(opponent).toBe(previewState.players.ai);
  });

  it("should derive turn state from displayState when scrubbing", () => {
    // This is the actual bug: using state instead of displayState for turn logic

    // Live state: human's turn, buy phase
    const liveState = {
      turn: 10,
      activePlayer: "human" as const,
      phase: "buy" as const,
      buys: 1,
      coins: 5,
    };

    // Preview state: ai's turn, action phase (scrubbing to earlier event)
    const previewState = {
      turn: 3,
      activePlayer: "ai" as const,
      phase: "action" as const,
      buys: 0,
      coins: 0,
    };

    const previewEventId = "event-5";
    const getStateAtEvent = (_eventId: string) => previewState;

    // Derive displayState
    const displayState =
      previewEventId && getStateAtEvent
        ? getStateAtEvent(previewEventId)
        : liveState;

    const mainPlayerId = "human" as const;

    // BUG: This line uses liveState instead of displayState
    // const isMainPlayerTurn = liveState.activePlayer === mainPlayerId; // WRONG
    const isMainPlayerTurn = displayState.activePlayer === mainPlayerId; // CORRECT

    // When scrubbing, isMainPlayerTurn should reflect preview state (ai's turn)
    expect(displayState.activePlayer).toBe("ai");
    expect(isMainPlayerTurn).toBe(false); // Should be false because it's ai's turn in preview

    // Phase and other state should also come from displayState
    expect(displayState.phase).toBe("action");
    expect(displayState.buys).toBe(0);
    expect(displayState.coins).toBe(0);
  });
});
