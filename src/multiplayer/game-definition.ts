/**
 * Martini Kit Game Definition for Dominion Multiplayer
 *
 * Defines the multiplayer state, lobby config, and actions.
 * The actual game logic is delegated to the existing game engine.
 */
import { defineGame } from "@martini-kit/core";
import type { GameState, CardName } from "../types/game-state";

/**
 * Player slot in the lobby - can be human or AI
 */
export interface PlayerSlot {
  id: string;
  name: string;
  type: "human" | "ai";
}

/**
 * Game settings configured in lobby
 */
export interface MultiplayerSettings {
  gameMode: "engine" | "llm" | "hybrid";
  kingdomCards?: CardName[];
}

/**
 * Multiplayer state wraps the Dominion game state
 */
export interface MultiplayerState {
  /** Player slots (2-4) */
  playerSlots: PlayerSlot[];

  /** Game settings */
  settings: MultiplayerSettings;

  /** The actual Dominion game state (null until game starts) */
  gameState: GameState | null;

  /** Mapping from martini playerId to Dominion player index */
  playerIdToIndex: Record<string, number>;
}

/**
 * Dominion multiplayer game definition
 */
export const dominionGame = defineGame<MultiplayerState>({
  // Lobby configuration
  lobby: {
    minPlayers: 2,
    maxPlayers: 4,
    requireAllReady: true,
    autoStartTimeout: 120000, // 2 minutes
    allowLateJoin: false,
  },

  // Initial state setup
  setup: ({ playerIds }) => ({
    playerSlots: playerIds.map((id, i) => ({
      id,
      name: `Player ${i + 1}`,
      type: "human" as const,
    })),
    settings: {
      gameMode: "hybrid",
    },
    gameState: null,
    playerIdToIndex: Object.fromEntries(playerIds.map((id, i) => [id, i])),
  }),

  // Actions
  actions: {
    /**
     * Update player name in lobby
     */
    setPlayerName: {
      apply(state, ctx, input: { name: string }) {
        const slot = state.playerSlots.find((s) => s.id === ctx.playerId);
        if (slot) {
          slot.name = input.name;
        }
      },
    },

    /**
     * Toggle a slot between human and AI (host only)
     */
    toggleSlotType: {
      apply(state, ctx, input: { slotIndex: number }) {
        const slot = state.playerSlots[input.slotIndex];
        if (slot) {
          slot.type = slot.type === "ai" ? "human" : "ai";
        }
      },
    },

    /**
     * Set game mode (host only)
     */
    setGameMode: {
      apply(state, _ctx: unknown, input: { mode: "engine" | "llm" | "hybrid" }) {
        void _ctx;
        state.settings.gameMode = input.mode;
      },
    },

    /**
     * Initialize the Dominion game state when transitioning to playing phase
     */
    initializeGame: {
      apply(state, _ctx, input: { gameState: GameState }) {
        state.gameState = input.gameState;
      },
    },

    /**
     * Execute a Dominion game action - replaces the entire game state
     * This is called after the host computes the new state using the game engine
     */
    updateGameState: {
      apply(state, _ctx, input: { gameState: GameState }) {
        state.gameState = input.gameState;
      },
    },
  },

  // Lifecycle hooks
  onPhaseChange: (state, { from, to, reason }) => {
    console.log(`[Dominion] Phase: ${from} → ${to} (${reason})`);
  },

  onPlayerJoin: (state, playerId) => {
    console.log(`[Dominion] Player joined: ${playerId}`);
    // Add new slot if under max
    if (state.playerSlots.length < 4) {
      state.playerSlots.push({
        id: playerId,
        name: `Player ${state.playerSlots.length + 1}`,
        type: "human",
      });
      state.playerIdToIndex[playerId] = state.playerSlots.length - 1;
    }
  },

  onPlayerLeave: (state, playerId) => {
    console.log(`[Dominion] Player left: ${playerId}`);
    // Mark slot as AI instead of removing (to preserve game state)
    const slot = state.playerSlots.find((s) => s.id === playerId);
    if (slot) {
      slot.type = "ai";
    }
  },

  onPlayerReady: (_state: MultiplayerState, playerId: string, ready: boolean) => {
    void _state;
    console.log(`[Dominion] ${playerId} is ${ready ? "ready" : "not ready"}`);
  },
});

export type DominionGameDefinition = typeof dominionGame;
