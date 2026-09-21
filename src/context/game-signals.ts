/**
 * Module-level views over the current game session.
 *
 * The session owns the state (see src/session). These computeds exist so
 * leaf components that only read game state keep rendering with fine-grained
 * reactivity; they are read-only, so nothing outside a session can write game
 * state. Only one whole session or none is ever bound, never a mix of one
 * session's fields and another's.
 */

import { signal, computed } from "@preact/signals";
import type { LlmSeatConfig, Seats } from "../core/seats";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { GameSession } from "../session/game-session";

const currentSession$ = signal<GameSession | null>(null);

export function bindSession(session: GameSession): void {
  if (currentSession$.peek() !== session) currentSession$.value = session;
}

/** Unbind only the given session, so a newer one bound in the same commit stays */
export function unbindSession(session: GameSession): void {
  if (currentSession$.peek() === session) currentSession$.value = null;
}

const EMPTY: never[] = [];
const NO_SEATS: Seats = {};
const NO_STRATEGIES: PlayerStrategyData = {};

const view = <T>(read: (session: GameSession) => T, fallback: T) =>
  computed(() => {
    const session = currentSession$.value;
    return session ? read(session) : fallback;
  });

/** Dominion's board state; null while another game, or none, is on the table */
export const gameState$ = view(
  s => (s.game === "dominion" ? s.state.value : null),
  null,
);
export const events$ = view(
  s => (s.game === "dominion" ? s.events.value : EMPTY),
  EMPTY,
);
export const seats$ = view(s => s.seats.value, NO_SEATS);
export const appMode$ = view(s => s.mode, "local");
export const localPlayerId$ = view(s => s.localPlayerId.value, null);
export const isProcessing$ = view(s => s.isProcessing.value, false);
export const playerStrategies$ = view(
  s => (s.game === "dominion" ? s.playerStrategies.value : NO_STRATEGIES),
  NO_STRATEGIES,
);
export const pendingUndo$ = view(
  s => (s.game === "dominion" ? s.pendingUndo.value : null),
  null,
);
export const llmLogs$ = view(s => s.llmLogs.value, EMPTY);
export const chatMessages$ = view(s => s.chatMessages.value, EMPTY);
export const isSpectator$ = view(s => s.isSpectator.value, false);
export const players$ = view(s => s.players.value, EMPTY);

// ---------------------------------------------------------------------------
// UI preferences that outlive any one session
// ---------------------------------------------------------------------------
/** Seat whose LLM settings panel should open, if any */
export const settingsSeat$ = signal<string | null>(null);
/** The LLM config each seat last had, so handing a seat back to an LLM restores its roster */
export const rememberedLlm$ = signal<Record<string, LlmSeatConfig>>({});
