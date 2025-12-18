import type { CardName } from "../types/game-state";
import type { DecisionChoice, PlayerId, GameEvent } from "../events/types";

/**
 * Commands represent player intent.
 * They are validated and converted to events by the command handler.
 */

// Game setup
export type StartGameCommand = {
  type: "START_GAME";
  players: PlayerId[];
  kingdomCards?: CardName[];
  seed?: number;
};

// Action phase
export type PlayActionCommand = {
  type: "PLAY_ACTION";
  playerId: PlayerId;
  card: CardName;
};

// Buy phase
export type PlayTreasureCommand = {
  type: "PLAY_TREASURE";
  playerId: PlayerId;
  card: CardName;
};

export type PlayAllTreasuresCommand = {
  type: "PLAY_ALL_TREASURES";
  playerId: PlayerId;
};

export type UnplayTreasureCommand = {
  type: "UNPLAY_TREASURE";
  playerId: PlayerId;
  card: CardName;
};

export type BuyCardCommand = {
  type: "BUY_CARD";
  playerId: PlayerId;
  card: CardName;
};

// Phase transitions
export type EndPhaseCommand = {
  type: "END_PHASE";
  playerId: PlayerId;
};

// Decision responses
export type SubmitDecisionCommand = {
  type: "SUBMIT_DECISION";
  playerId: PlayerId;
  choice: DecisionChoice;
};

export type SkipDecisionCommand = {
  type: "SKIP_DECISION";
  playerId: PlayerId;
};

// Reaction responses (first-class)
export type RevealReactionCommand = {
  type: "REVEAL_REACTION";
  playerId: PlayerId;
  card: CardName;
};

export type DeclineReactionCommand = {
  type: "DECLINE_REACTION";
  playerId: PlayerId;
};

// Undo system
export type RequestUndoCommand = {
  type: "REQUEST_UNDO";
  playerId: PlayerId;
  toEventId: string; // Changed from toEventIndex to toEventId for causality tracking
  reason?: string;
};

export type ApproveUndoCommand = {
  type: "APPROVE_UNDO";
  playerId: PlayerId;
  requestId: string;
};

export type DenyUndoCommand = {
  type: "DENY_UNDO";
  playerId: PlayerId;
  requestId: string;
};

// Union of all commands
export type GameCommand =
  | StartGameCommand
  | PlayActionCommand
  | PlayTreasureCommand
  | PlayAllTreasuresCommand
  | UnplayTreasureCommand
  | BuyCardCommand
  | EndPhaseCommand
  | SubmitDecisionCommand
  | SkipDecisionCommand
  | RevealReactionCommand
  | DeclineReactionCommand
  | RequestUndoCommand
  | ApproveUndoCommand
  | DenyUndoCommand;

/**
 * Result of handling a command.
 */
export type CommandResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; error: string };
