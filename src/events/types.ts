import type {
  CardName,
  Phase,
  DecisionRequest,
  DecisionChoice,
} from "../types/game-state";
import { multiplayerLogger } from "../lib/logger";

export type { DecisionRequest, DecisionChoice };

// PlayerId - string for multiplayer flexibility (can be custom peer IDs or Player enum values)
export type PlayerId = string;

// Zones where cards can exist
export type Zone = "hand" | "deck" | "discard" | "inPlay" | "supply" | "trash";

// ============================================
// GAME EVENTS - Immutable facts (past tense)
// ============================================

/**
 * Base event metadata for causality tracking
 */
export type EventMetadata = {
  /** Unique event ID for causality tracking (optional when creating, required when stored) */
  id?: string;
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

export type TurnEndedEvent = EventMetadata & {
  type: "TURN_ENDED";
  player: PlayerId;
  turn: number;
};

export type PhaseChangedEvent = EventMetadata & {
  type: "PHASE_CHANGED";
  phase: Phase;
};

// Card Movements (atomic primitives)
export type DrawEvent = EventMetadata & {
  type: "DRAW";
  player: PlayerId;
  count: number;
};

export type CardDrawnEvent = EventMetadata & {
  type: "CARD_DRAWN";
  player: PlayerId;
  card: CardName;
};

export type CardPlayedEvent = EventMetadata & {
  type: "CARD_PLAYED";
  player: PlayerId;
  card: CardName;
};

export type CardDiscardedEvent = EventMetadata & {
  type: "CARD_DISCARDED";
  player: PlayerId;
  card: CardName;
  from: "hand" | "inPlay" | "deck";
};

export type CardTrashedEvent = EventMetadata & {
  type: "CARD_TRASHED";
  player: PlayerId;
  card: CardName;
  from: "hand" | "deck" | "inPlay";
};

export type CardGainedEvent = EventMetadata & {
  type: "CARD_GAINED";
  player: PlayerId;
  card: CardName;
  to: "hand" | "discard" | "deck";
};

export type CardRevealedEvent = EventMetadata & {
  type: "CARD_REVEALED";
  player: PlayerId;
  card: CardName;
  from: "hand" | "deck" | "discard";
};

export type CardPeekedEvent = EventMetadata & {
  type: "CARD_PEEKED";
  player: PlayerId;
  card: CardName;
  from: "deck" | "discard";
};

export type DeckShuffledEvent = EventMetadata & {
  type: "DECK_SHUFFLED";
  player: PlayerId;
  /** New deck order after shuffle (for perfect replay fidelity) */
  newDeckOrder?: CardName[];
};

export type CardPutOnDeckEvent = EventMetadata & {
  type: "CARD_PUT_ON_DECK";
  player: PlayerId;
  card: CardName;
  from: "hand" | "discard";
};

export type CardReturnedToHandEvent = EventMetadata & {
  type: "CARD_RETURNED_TO_HAND";
  player: PlayerId;
  card: CardName;
  from: "inPlay" | "discard" | "deck";
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

// Effects (persistent modifiers like cost reduction)
export type EffectRegisteredEvent = EventMetadata & {
  type: "EFFECT_REGISTERED";
  player: PlayerId;
  effectType: "cost_reduction";
  source: CardName;
  parameters: {
    amount: number;
  };
};

// Cost modifications (emitted during purchase to show applied modifiers)
export type CostModifiedEvent = EventMetadata & {
  type: "COST_MODIFIED";
  card: CardName;
  baseCost: number;
  modifiedCost: number;
  modifiers: Array<{
    source: CardName;
    delta: number;
  }>;
};

// Attack and Reaction Events
export type AttackDeclaredEvent = EventMetadata & {
  type: "ATTACK_DECLARED";
  attacker: PlayerId;
  attackCard: CardName;
  targets: PlayerId[];
};

export type AttackResolvedEvent = EventMetadata & {
  type: "ATTACK_RESOLVED";
  attacker: PlayerId;
  target: PlayerId;
  attackCard: CardName;
  blocked: boolean;
};

export type ReactionPlayedEvent = EventMetadata & {
  type: "REACTION_PLAYED";
  player: PlayerId;
  card: CardName;
  triggerEventId: string;
};

// Decisions (DecisionRequest and DecisionChoice moved to types/game-state to break circular dep)
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
  toEventId: string; // Changed from toEventIndex to toEventId
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
  fromEventId: string; // Changed from index to ID
  toEventId: string; // Changed from index to ID
};

// Union of all events
export type GameEvent =
  // Setup
  | GameInitializedEvent
  | InitialDeckDealtEvent
  | InitialHandDrawnEvent
  // Turn structure
  | TurnStartedEvent
  | TurnEndedEvent
  | PhaseChangedEvent
  // Card movements
  | DrawEvent
  | CardDrawnEvent
  | CardPlayedEvent
  | CardDiscardedEvent
  | CardTrashedEvent
  | CardGainedEvent
  | CardRevealedEvent
  | CardPeekedEvent
  | DeckShuffledEvent
  | CardPutOnDeckEvent
  | CardReturnedToHandEvent
  // Resources
  | ActionsModifiedEvent
  | BuysModifiedEvent
  | CoinsModifiedEvent
  // Effects
  | EffectRegisteredEvent
  | CostModifiedEvent
  // Attacks and Reactions
  | AttackDeclaredEvent
  | AttackResolvedEvent
  | ReactionPlayedEvent
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
export function isCardMovementEvent(
  event: GameEvent,
): event is
  | CardDrawnEvent
  | CardPlayedEvent
  | CardDiscardedEvent
  | CardTrashedEvent
  | CardGainedEvent
  | CardPutOnDeckEvent {
  return [
    "CARD_DRAWN",
    "CARD_PLAYED",
    "CARD_DISCARDED",
    "CARD_TRASHED",
    "CARD_GAINED",
    "CARD_PUT_ON_DECK",
  ].includes(event.type);
}

export function isResourceEvent(
  event: GameEvent,
): event is ActionsModifiedEvent | BuysModifiedEvent | CoinsModifiedEvent {
  return ["ACTIONS_MODIFIED", "BUYS_MODIFIED", "COINS_MODIFIED"].includes(
    event.type,
  );
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
export function getCausalChain(
  eventId: string,
  allEvents: GameEvent[],
): Set<string> {
  let chain = new Set([eventId]);
  let changed = true;

  while (changed) {
    const newChain = allEvents.reduce((acc, evt) => {
      if (
        evt.id &&
        evt.causedBy &&
        chain.has(evt.causedBy) &&
        !chain.has(evt.id)
      ) {
        return new Set([...acc, evt.id]);
      }
      return acc;
    }, chain);

    changed = newChain.size !== chain.size;
    chain = newChain;
  }

  return chain;
}

/**
 * Remove an event and all events that came after it (undo/rewind semantics)
 */
export function removeEventChain(
  eventId: string,
  allEvents: GameEvent[],
): GameEvent[] {
  const targetIndex = allEvents.findIndex(e => e.id === eventId);
  if (targetIndex === -1) {
    multiplayerLogger.warn(`[removeEventChain] Event ${eventId} not found`);
    return allEvents;
  }

  // "Undo to here" means: keep this event and all its direct effects (causedBy this event)
  // Find the last event that is caused by (or transitively caused by) the target event

  // Collect all events directly or transitively caused by target
  const result = allEvents.slice(targetIndex + 1).reduce<{
    causedIds: Set<string>;
    lastRelatedIndex: number;
  }>(
    (acc, event, idx) => {
      const absoluteIndex = targetIndex + 1 + idx;
      if (event.id && event.causedBy && acc.causedIds.has(event.causedBy)) {
        return {
          causedIds: new Set([...acc.causedIds, event.id]),
          lastRelatedIndex: absoluteIndex,
        };
      }
      return acc;
    },
    { causedIds: new Set<string>([eventId]), lastRelatedIndex: targetIndex },
  );

  // Keep everything up to and including the last related event
  return allEvents.slice(0, result.lastRelatedIndex + 1);
}
