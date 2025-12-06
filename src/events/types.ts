import { z } from "zod";
import type { CardName, Phase, Player } from "../types/game-state";

// PlayerId - string for multiplayer flexibility
export type PlayerId = Player; // Will migrate to string later

// Zones where cards can exist
export const Zone = z.enum(["hand", "deck", "discard", "inPlay", "supply", "trash"]);
export type Zone = z.infer<typeof Zone>;

// ============================================
// GAME EVENTS - Immutable facts (past tense)
// ============================================

/**
 * Base event metadata for causality tracking
 */
export type EventMetadata = {
  /** Unique event ID for causality tracking */
  id: string;
  /** ID of the event that caused this event (for atomic undo) */
  causedBy?: string;
};

// Game Setup
export type GameInitializedEvent = EventMetadata & {
  type: "GAME_INITIALIZED";
  players: PlayerId[];
  kingdomCards: CardName[];
  supply: Record<string, number>;
  seed?: number;
};

export type InitialDeckDealtEvent = EventMetadata & {
  type: "INITIAL_DECK_DEALT";
  player: PlayerId;
  cards: CardName[];
};

export type InitialHandDrawnEvent = EventMetadata & {
  type: "INITIAL_HAND_DRAWN";
  player: PlayerId;
  cards: CardName[];
};

// Turn Structure
export type TurnStartedEvent = EventMetadata & {
  type: "TURN_STARTED";
  turn: number;
  player: PlayerId;
};

export type PhaseChangedEvent = EventMetadata & {
  type: "PHASE_CHANGED";
  phase: Phase;
};

// Card Movements (atomic primitives)
export type CardsDrawnEvent = EventMetadata & {
  type: "CARDS_DRAWN";
  player: PlayerId;
  cards: CardName[];
};

export type CardPlayedEvent = EventMetadata & {
  type: "CARD_PLAYED";
  player: PlayerId;
  card: CardName;
};

export type CardsDiscardedEvent = EventMetadata & {
  type: "CARDS_DISCARDED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "inPlay" | "deck";
};

export type CardsTrashedEvent = EventMetadata & {
  type: "CARDS_TRASHED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "deck" | "inPlay";
};

export type CardGainedEvent = EventMetadata & {
  type: "CARD_GAINED";
  player: PlayerId;
  card: CardName;
  to: "hand" | "discard" | "deck";
};

export type CardsRevealedEvent = EventMetadata & {
  type: "CARDS_REVEALED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "deck";
};

export type DeckShuffledEvent = EventMetadata & {
  type: "DECK_SHUFFLED";
  player: PlayerId;
  /** New deck order after shuffle (for perfect replay fidelity) */
  newDeckOrder?: CardName[];
};

export type CardsPutOnDeckEvent = EventMetadata & {
  type: "CARDS_PUT_ON_DECK";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "discard";
};

// Resources
export type ActionsModifiedEvent = EventMetadata & {
  type: "ACTIONS_MODIFIED";
  delta: number;
};

export type BuysModifiedEvent = EventMetadata & {
  type: "BUYS_MODIFIED";
  delta: number;
};

export type CoinsModifiedEvent = EventMetadata & {
  type: "COINS_MODIFIED";
  delta: number;
};

// Decisions
export type DecisionRequest = {
  type: "select_cards";
  player: PlayerId;
  from: "hand" | "supply" | "revealed" | "options";
  prompt: string;
  cardOptions?: CardName[]; // For supply/options selections
  min: number;
  max: number;
  cardBeingPlayed: CardName;
  stage?: string;
  metadata?: Record<string, unknown>;
};

export type DecisionChoice = {
  selectedCards: CardName[];
};

export type DecisionRequiredEvent = EventMetadata & {
  type: "DECISION_REQUIRED";
  decision: DecisionRequest;
};

export type DecisionResolvedEvent = EventMetadata & {
  type: "DECISION_RESOLVED";
  player: PlayerId;
  choice: DecisionChoice;
};

// Game End
export type GameEndedEvent = EventMetadata & {
  type: "GAME_ENDED";
  winner: PlayerId | null;
  scores: Record<PlayerId, number>;
  reason: "provinces_empty" | "three_piles_empty";
};

// Undo System
export type UndoRequestedEvent = EventMetadata & {
  type: "UNDO_REQUESTED";
  requestId: string;
  byPlayer: PlayerId;
  toEventId: string;  // Changed from toEventIndex to toEventId
  reason?: string;
};

export type UndoApprovedEvent = EventMetadata & {
  type: "UNDO_APPROVED";
  requestId: string;
  byPlayer: PlayerId;
};

export type UndoDeniedEvent = EventMetadata & {
  type: "UNDO_DENIED";
  requestId: string;
  byPlayer: PlayerId;
};

export type UndoExecutedEvent = EventMetadata & {
  type: "UNDO_EXECUTED";
  fromEventId: string;  // Changed from index to ID
  toEventId: string;    // Changed from index to ID
};

// Union of all events
export type GameEvent =
  // Setup
  | GameInitializedEvent
  | InitialDeckDealtEvent
  | InitialHandDrawnEvent
  // Turn structure
  | TurnStartedEvent
  | PhaseChangedEvent
  // Card movements
  | CardsDrawnEvent
  | CardPlayedEvent
  | CardsDiscardedEvent
  | CardsTrashedEvent
  | CardGainedEvent
  | CardsRevealedEvent
  | DeckShuffledEvent
  | CardsPutOnDeckEvent
  // Resources
  | ActionsModifiedEvent
  | BuysModifiedEvent
  | CoinsModifiedEvent
  // Decisions
  | DecisionRequiredEvent
  | DecisionResolvedEvent
  // Game end
  | GameEndedEvent
  // Undo
  | UndoRequestedEvent
  | UndoApprovedEvent
  | UndoDeniedEvent
  | UndoExecutedEvent;

// Event type guard helpers
export function isCardMovementEvent(event: GameEvent): event is
  | CardsDrawnEvent
  | CardPlayedEvent
  | CardsDiscardedEvent
  | CardsTrashedEvent
  | CardGainedEvent
  | CardsPutOnDeckEvent {
  return [
    "CARDS_DRAWN",
    "CARD_PLAYED",
    "CARDS_DISCARDED",
    "CARDS_TRASHED",
    "CARD_GAINED",
    "CARDS_PUT_ON_DECK"
  ].includes(event.type);
}

export function isResourceEvent(event: GameEvent): event is
  | ActionsModifiedEvent
  | BuysModifiedEvent
  | CoinsModifiedEvent {
  return ["ACTIONS_MODIFIED", "BUYS_MODIFIED", "COINS_MODIFIED"].includes(event.type);
}

// ============================================
// CAUSALITY HELPERS
// ============================================

/**
 * Check if an event is a root cause (user action) vs an effect
 * Root causes are valid undo checkpoints
 *
 * Simple rule: An event is a root if nothing caused it
 */
export function isRootCauseEvent(event: GameEvent): boolean {
  return !event.causedBy;
}

/**
 * Get all events in a causal chain (event + all events it caused, recursively)
 */
export function getCausalChain(eventId: string, allEvents: GameEvent[]): Set<string> {
  const chain = new Set([eventId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const evt of allEvents) {
      if (evt.causedBy && chain.has(evt.causedBy) && !chain.has(evt.id)) {
        chain.add(evt.id);
        changed = true;
      }
    }
  }

  return chain;
}

/**
 * Remove an event and all events it caused from the event log
 */
export function removeEventChain(eventId: string, allEvents: GameEvent[]): GameEvent[] {
  const toRemove = getCausalChain(eventId, allEvents);
  return allEvents.filter(e => !toRemove.has(e.id));
}
