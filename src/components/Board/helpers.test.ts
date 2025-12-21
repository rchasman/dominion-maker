import { describe, it, expect } from "bun:test";
import { getHintText } from "./helpers";
import type { GameState, PlayerId } from "../../types/game-state";

describe("Board/helpers", () => {
  describe("getHintText", () => {
    const baseState: GameState = {
      turn: 1,
      phase: "action",
      activePlayerId: "human",
      actions: 1,
      buys: 1,
      coins: 0,
      players: {
        human: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
        },
        ai: {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
        },
      },
      supply: {},
      trash: [],
      pendingChoice: null,
      gameOver: false,
      log: [],
    };

    it("should show reaction prompt when pending reaction for local player even on opponent turn", () => {
      const state: GameState = {
        ...baseState,
        activePlayerId: "ai",
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          attackCard: "Militia",
          attacker: "ai",
        } as any,
      };

      const hint = getHintText({
        displayState: state,
        localPlayerId: "human",
        isLocalPlayerTurn: false,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("ai played Militia. Reveal a reaction?");
    });

    it("should not show reaction prompt when pending reaction for other player", () => {
      const state: GameState = {
        ...baseState,
        phase: "action",
        pendingChoice: {
          choiceType: "reaction",
          playerId: "ai",
          attackCard: "Militia",
          attacker: "human",
        } as any,
      };

      const hint = getHintText({
        displayState: state,
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("");
    });

    it("should show decision prompt when pending decision for local player", () => {
      const state: GameState = {
        ...baseState,
        activePlayerId: "human",
        pendingChoice: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Trash up to 2 cards",
          cardOptions: ["Copper", "Estate"],
          cardBeingPlayed: "Chapel",
          min: 0,
          max: 2,
        } as any,
      };

      const hint = getHintText({
        displayState: state,
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("Trash up to 2 cards");
    });

    it("should show opponent playing message when not local player turn", () => {
      const hint = getHintText({
        displayState: baseState,
        localPlayerId: "ai",
        isLocalPlayerTurn: false,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("Opponent is playing...");
    });

    it("should show action prompt in action phase with playable actions", () => {
      const hint = getHintText({
        displayState: { ...baseState, phase: "action" },
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: true,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("Click an Action card to play it");
    });

    it("should show empty string in action phase without playable actions", () => {
      const hint = getHintText({
        displayState: { ...baseState, phase: "action" },
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("");
    });

    it("should prompt to play treasures in buy phase with 0 coins and treasures in hand", () => {
      const hint = getHintText({
        displayState: { ...baseState, phase: "buy", coins: 0 },
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: true,
      });

      expect(hint).toBe("Play treasures to get coins");
    });

    it("should prompt to take back treasures when treasures are in play", () => {
      const stateWithInPlayTreasures: GameState = {
        ...baseState,
        phase: "buy",
        coins: 3,
        players: {
          ...baseState.players,
          human: {
            ...baseState.players.human,
            inPlay: ["Copper", "Silver"],
          },
        },
      };

      const hint = getHintText({
        displayState: stateWithInPlayTreasures,
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("Click played treasures to take back");
    });

    it("should show empty string in buy phase with coins and no treasures in play", () => {
      const hint = getHintText({
        displayState: { ...baseState, phase: "buy", coins: 5 },
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("");
    });

    it("should prioritize reaction over opponent playing message", () => {
      const state: GameState = {
        ...baseState,
        activePlayerId: "ai",
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          attackCard: "Witch",
          attacker: "ai",
        } as any,
      };

      const hint = getHintText({
        displayState: state,
        localPlayerId: "human",
        isLocalPlayerTurn: false,
        hasPlayableActions: false,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("ai played Witch. Reveal a reaction?");
    });

    it("should prioritize pending decision over phase hints", () => {
      const state: GameState = {
        ...baseState,
        phase: "action",
        activePlayerId: "human",
        pendingChoice: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Choose a card",
          cardOptions: ["Village"],
          cardBeingPlayed: "Workshop",
          min: 1,
          max: 1,
        } as any,
      };

      const hint = getHintText({
        displayState: state,
        localPlayerId: "human",
        isLocalPlayerTurn: true,
        hasPlayableActions: true,
        hasTreasuresInHand: false,
      });

      expect(hint).toBe("Choose a card");
    });
  });
});
