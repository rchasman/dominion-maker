/**
 * Signal atoms for game state
 *
 * Signals are the PRIMARY state owner for the game. All hooks write directly
 * to these signals; no useState -> useEffect -> signal mirroring.
 */

import { signal, computed, batch } from "@preact/signals";
import type { DominionEngine } from "../engine";
import type { GameState, CardName } from "../types/game-state";
import type { DecisionChoice } from "../events/types";
import type { GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { ModelSettings } from "../agent/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ChatMessageData } from "../types/multiplayer";
import type { PendingUndoRequest } from "../engine/engine";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import { DEFAULT_MODEL_SETTINGS } from "../agent/types";

// ---------------------------------------------------------------------------
// Core state signals
// ---------------------------------------------------------------------------
export const gameState$ = signal<GameState | null>(null);
export const events$ = signal<GameEvent[]>([]);
export const gameMode$ = signal<GameMode>("engine");
export const localPlayerId$ = signal<string | null>(null);
export const isProcessing$ = signal(false);
export const isLoading$ = signal(false);
export const playerStrategies$ = signal<PlayerStrategyData>({});
export const modelSettings$ = signal<ModelSettings>(DEFAULT_MODEL_SETTINGS);
export const strategy$ = signal<GameStrategy | null>(null);

// ---------------------------------------------------------------------------
// Derived signals (match the same logic as GameContext useMemo calls)
// ---------------------------------------------------------------------------
export const hasPlayableActions$ = computed(() =>
  computeHasPlayableActions(gameState$.value),
);

export const hasTreasuresInHand$ = computed(() =>
  computeHasTreasuresInHand(gameState$.value),
);

// ---------------------------------------------------------------------------
// Action callback signals
// ---------------------------------------------------------------------------
export const playAction$ = signal<((card: CardName) => CommandResult) | null>(
  null,
);
export const playTreasure$ = signal<((card: CardName) => CommandResult) | null>(
  null,
);
export const unplayTreasure$ = signal<
  ((card: CardName) => CommandResult) | null
>(null);
export const playAllTreasures$ = signal<(() => CommandResult) | null>(null);
export const buyCard$ = signal<((card: CardName) => CommandResult) | null>(
  null,
);
export const endPhase$ = signal<(() => CommandResult) | null>(null);
export const submitDecision$ = signal<
  ((choice: DecisionChoice) => CommandResult) | null
>(null);
export const revealReaction$ = signal<
  ((card: CardName) => CommandResult) | null
>(null);
export const declineReaction$ = signal<(() => CommandResult) | null>(null);

// ---------------------------------------------------------------------------
// Undo signals
// ---------------------------------------------------------------------------
export const requestUndo$ = signal<((toEventId: string) => void) | null>(null);
export const approveUndo$ = signal<((requestId: string) => void) | null>(null);
export const denyUndo$ = signal<((requestId: string) => void) | null>(null);
export const pendingUndo$ = signal<PendingUndoRequest | null>(null);

// ---------------------------------------------------------------------------
// Setup / config action signals
// ---------------------------------------------------------------------------
export const startGame$ = signal<(() => void) | null>(null);
export const setGameMode$ = signal<((mode: GameMode) => void) | null>(null);
export const setModelSettings$ = signal<
  ((settings: Partial<ModelSettings>) => void) | null
>(null);
export const getStateAtEvent$ = signal<((eventId: string) => GameState) | null>(
  null,
);

// ---------------------------------------------------------------------------
// LLM logs signal
// ---------------------------------------------------------------------------
export const llmLogs$ = signal<LLMLogEntry[]>([]);

// ---------------------------------------------------------------------------
// Multiplayer-specific signals (defaults match single-player)
// ---------------------------------------------------------------------------
export const chatMessages$ = signal<ChatMessageData[]>([]);
export const sendChat$ = signal<((message: string) => void) | null>(null);
export const spectatorCount$ = signal(0);
export const isSpectator$ = signal(false);
export const localPlayerName$ = signal<string | undefined>();
export const players$ = signal<Array<{ id: string; name: string }>>([]);

// ---------------------------------------------------------------------------
// Engine → signals sync helper
// ---------------------------------------------------------------------------
/**
 * Atomically sync engine state into signals.
 * This is the single source of truth for state updates after engine commands.
 */
export function syncEngineToSignals(engine: DominionEngine): void {
  batch(() => {
    events$.value = [...engine.eventLog];
    gameState$.value = engine.state;
  });
}
