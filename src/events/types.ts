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

// Game Setup
export type GameInitializedEvent = {
  type: "GAME_INITIALIZED";
  players: PlayerId[];
  kingdomCards: CardName[];
  supply: Record<string, number>;
  seed?: number;
};

export type InitialDeckDealtEvent = {
  type: "INITIAL_DECK_DEALT";
  player: PlayerId;
  cards: CardName[];
};

export type InitialHandDrawnEvent = {
  type: "INITIAL_HAND_DRAWN";
  player: PlayerId;
  cards: CardName[];
};

// Turn Structure
export type TurnStartedEvent = {
  type: "TURN_STARTED";
  turn: number;
  player: PlayerId;
};

export type PhaseChangedEvent = {
  type: "PHASE_CHANGED";
  phase: Phase;
};

// Card Movements (atomic primitives)
export type CardsDrawnEvent = {
  type: "CARDS_DRAWN";
  player: PlayerId;
  cards: CardName[];
};

export type CardPlayedEvent = {
  type: "CARD_PLAYED";
  player: PlayerId;
  card: CardName;
};

export type CardsDiscardedEvent = {
  type: "CARDS_DISCARDED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "inPlay" | "deck";
};

export type CardsTrashedEvent = {
  type: "CARDS_TRASHED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "deck" | "inPlay";
};

export type CardGainedEvent = {
  type: "CARD_GAINED";
  player: PlayerId;
  card: CardName;
  to: "hand" | "discard" | "deck";
};

export type CardsRevealedEvent = {
  type: "CARDS_REVEALED";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "deck";
};

export type DeckShuffledEvent = {
  type: "DECK_SHUFFLED";
  player: PlayerId;
  // Note: We don't store the shuffle result - that's derived from RNG seed or stored in deck state
};

export type CardsPutOnDeckEvent = {
  type: "CARDS_PUT_ON_DECK";
  player: PlayerId;
  cards: CardName[];
  from: "hand" | "discard";
};

// Resources
export type ActionsModifiedEvent = {
  type: "ACTIONS_MODIFIED";
  delta: number;
};

export type BuysModifiedEvent = {
  type: "BUYS_MODIFIED";
  delta: number;
};

export type CoinsModifiedEvent = {
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

export type DecisionRequiredEvent = {
  type: "DECISION_REQUIRED";
  decision: DecisionRequest;
};

export type DecisionResolvedEvent = {
  type: "DECISION_RESOLVED";
  player: PlayerId;
  choice: DecisionChoice;
};

// Game End
export type GameEndedEvent = {
  type: "GAME_ENDED";
  winner: PlayerId | null;
  scores: Record<PlayerId, number>;
  reason: "provinces_empty" | "three_piles_empty";
};

// Undo System
export type UndoRequestedEvent = {
  type: "UNDO_REQUESTED";
  requestId: string;
  byPlayer: PlayerId;
  toEventIndex: number;
  reason?: string;
};

export type UndoApprovedEvent = {
  type: "UNDO_APPROVED";
  requestId: string;
  byPlayer: PlayerId;
};

export type UndoDeniedEvent = {
  type: "UNDO_DENIED";
  requestId: string;
  byPlayer: PlayerId;
};

export type UndoExecutedEvent = {
  type: "UNDO_EXECUTED";
  fromEventIndex: number;
  toEventIndex: number;
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
