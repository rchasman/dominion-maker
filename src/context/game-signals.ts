/**
 * Signal atoms for game state - Phase 1 (mirror from useState)
 *
 * These signals mirror the existing useState values from GameProvider.
 * Phase 1 only syncs state into signals; consumers remain on useContext.
 * Future phases will read directly from signals to skip re-renders.
 */

import { signal, computed } from "@preact/signals";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { GameMode } from "../types/game-mode";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { ModelSettings } from "../agent/types";
import type { ChatMessageData } from "../partykit/protocol";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import { DEFAULT_MODEL_SETTINGS } from "../agent/types";

// Core state signals
export const gameState$ = signal<GameState | null>(null);
export const events$ = signal<GameEvent[]>([]);
export const gameMode$ = signal<GameMode>("engine");
export const localPlayerId$ = signal<string | null>(null);
export const isProcessing$ = signal(false);
export const isLoading$ = signal(false);
export const playerStrategies$ = signal<PlayerStrategyData>({});
export const modelSettings$ = signal<ModelSettings>(DEFAULT_MODEL_SETTINGS);

// Multiplayer-specific signals (defaults match single-player: no chat/spectators)
export const chatMessages$ = signal<ChatMessageData[]>([]);
export const sendChat$ = signal<((message: string) => void) | null>(null);
export const spectatorCount$ = signal(0);
export const isSpectator$ = signal(false);

// Derived signals (match the same logic as GameContext useMemo calls)
export const hasPlayableActions$ = computed(() =>
  computeHasPlayableActions(gameState$.value),
);

export const hasTreasuresInHand$ = computed(() =>
  computeHasTreasuresInHand(gameState$.value),
);
