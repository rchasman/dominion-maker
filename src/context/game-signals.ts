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
import type { PlayerStrategyData } from "../types/player-strategy";
import type { ControllerConfig, Seats } from "../core/seats";
import { firstHumanSeat, withSeat } from "../core/seats";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ChatMessageData } from "../partykit/protocol";
import type { PendingUndoRequest } from "../engine/engine";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";

// ---------------------------------------------------------------------------
// Core state signals
// ---------------------------------------------------------------------------
export const gameState$ = signal<GameState | null>(null);
export const events$ = signal<GameEvent[]>([]);
/** Who controls each player: the stored truth that replaced GameMode */
export const seats$ = signal<Seats>({});
export const appMode$ = signal<"local" | "multiplayer">("local");
/** Multiplayer only: this client's player id. Local games derive it from seats. */
export const localPlayerId$ = signal<string | null>(null);
/** Seat whose LLM settings panel should open, if any */
export const settingsSeat$ = signal<string | null>(null);
export const isProcessing$ = signal(false);
export const isLoading$ = signal(false);
export const playerStrategies$ = signal<PlayerStrategyData>({});

/** The seat a human at this client acts for: their own id in multiplayer, else the first human seat */
export const localHumanSeat$ = computed<string | null>(() =>
  appMode$.value === "multiplayer"
    ? localPlayerId$.value
    : firstHumanSeat(seats$.value, gameState$.value?.playerOrder ?? []),
);

export const setSeat$ = signal<
  ((player: string, config: ControllerConfig) => void) | null
>(null);

// ---------------------------------------------------------------------------
// Derived signals (match the same logic as GameContext useMemo calls)
// ---------------------------------------------------------------------------
export const hasPlayableActions$ = computed(() =>
  computeHasPlayableActions(gameState$.value, localHumanSeat$.value),
);

export const hasTreasuresInHand$ = computed(() =>
  computeHasTreasuresInHand(gameState$.value, localHumanSeat$.value),
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

export function updateSeat(player: string, config: ControllerConfig): void {
  seats$.value = withSeat(seats$.value, player, config);
}
export const getStateAtEvent$ = signal<
  ((eventId: string) => GameState | Promise<GameState>) | null
>(null);

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
