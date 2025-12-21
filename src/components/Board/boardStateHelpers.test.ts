import { describe, it, expect } from "bun:test";
import { computeBoardState } from "./boardStateHelpers";
import type { GameState } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";

describe("Board/boardStateHelpers", () => {
  describe("computeBoardState", () => {
    const baseState: GameState = {
      turn: 1,
      phase: "action",
      activePlayerId: "human",
      actions: 1,
      buys: 1,
      coins: 0,
      players: {
        human: {
          deck: ["Copper", "Copper"],
          hand: ["Copper", "Estate", "Village"],
          discard: ["Estate"],
          inPlay: [],
        },
        ai: {
          deck: ["Silver"],
          hand: ["Copper"],
          discard: [],
          inPlay: [],
        },
      },
      supply: {
        Village: { count: 10, cost: 3 },
        Copper: { count: 46, cost: 0 },
      },
      trash: [],
      pendingChoice: null,
      gameOver: false,
      log: [],
    };

    const mockGetStateAtEvent = (eventId: string) => baseState;

    it("should compute board state using live state when not in preview mode", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: true,
        hasTreasuresInHand: true,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.displayState).toBe(baseState);
      expect(result.localPlayerId).toBe("human");
      expect(result.opponentPlayerId).toBe("ai");
      expect(result.isLocalPlayerTurn).toBe(true);
    });

    it("should compute board state using preview state when in preview mode", () => {
      const previewState: GameState = {
        ...baseState,
        turn: 5,
        activePlayerId: "ai",
      };

      const getPreviewState = (eventId: string) =>
        eventId === "preview-123" ? previewState : baseState;

      const result = computeBoardState({
        state: baseState,
        previewEventId: "preview-123",
        isPreviewMode: true,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: getPreviewState,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.displayState).toBe(previewState);
      expect(result.displayState.turn).toBe(5);
      expect(result.displayState.activePlayerId).toBe("ai");
      expect(result.isLocalPlayerTurn).toBe(false);
    });

    it("should calculate VP correctly for both players", () => {
      const stateWithVictory: GameState = {
        ...baseState,
        players: {
          human: {
            deck: ["Estate", "Estate"],
            hand: ["Province"],
            discard: ["Duchy"],
            inPlay: [],
          },
          ai: {
            deck: ["Estate"],
            hand: ["Estate", "Estate"],
            discard: [],
            inPlay: [],
          },
        },
      };

      const result = computeBoardState({
        state: stateWithVictory,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      // Province=6, Duchy=3, Estate=1, Estate=1 = 11 VP
      expect(result.localPlayerVP).toBe(11);
      // Estate=1, Estate=1, Estate=1 = 3 VP
      expect(result.opponentVP).toBe(3);
    });

    it("should set isLocalPlayerTurn to false when spectator", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: true,
      });

      expect(result.isLocalPlayerTurn).toBe(false);
    });

    it("should calculate canBuy correctly in buy phase with buys", () => {
      const buyState: GameState = {
        ...baseState,
        phase: "buy",
        buys: 1,
      };

      const result = computeBoardState({
        state: buyState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.canBuy).toBe(true);
    });

    it("should set canBuy to false in preview mode", () => {
      const buyState: GameState = {
        ...baseState,
        phase: "buy",
        buys: 1,
      };

      const result = computeBoardState({
        state: buyState,
        previewEventId: "event-123",
        isPreviewMode: true,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.canBuy).toBe(false);
    });

    it("should set canBuy to false when not local player turn", () => {
      const buyState: GameState = {
        ...baseState,
        phase: "buy",
        buys: 1,
        activePlayerId: "ai",
      };

      const result = computeBoardState({
        state: buyState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.canBuy).toBe(false);
    });

    it("should identify AI players correctly", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.isLocalPlayerAI).toBe(false);
      expect(result.isOpponentAI).toBe(true);
    });

    it("should identify both as AI in full mode", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "full",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.isLocalPlayerAI).toBe(true);
      expect(result.isOpponentAI).toBe(true);
    });

    it("should generate hint text based on game state", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: true,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: "human",
        isSpectator: false,
      });

      expect(result.hint).toBe("Click an Action card to play it");
    });

    it("should throw error when player state not found", () => {
      const invalidState: GameState = {
        ...baseState,
        players: {
          human: baseState.players.human,
        } as any,
      };

      expect(() =>
        computeBoardState({
          state: invalidState,
          previewEventId: null,
          isPreviewMode: false,
          gameMode: "hybrid",
          hasPlayableActions: false,
          hasTreasuresInHand: false,
          getStateAtEvent: mockGetStateAtEvent,
          localPlayerId: "human",
          isSpectator: false,
        }),
      ).toThrow("Player state not found");
    });

    it("should use resolved local player ID from perspective", () => {
      const result = computeBoardState({
        state: baseState,
        previewEventId: null,
        isPreviewMode: false,
        gameMode: "hybrid",
        hasPlayableActions: false,
        hasTreasuresInHand: false,
        getStateAtEvent: mockGetStateAtEvent,
        localPlayerId: null,
        isSpectator: false,
      });

      expect(result.localPlayerId).toBe("human");
      expect(result.opponentPlayerId).toBe("ai");
    });
  });
});
