// Re-export basic types
export type { CardName, PlayerId } from "./basic-types";

export type Phase = "action" | "buy" | "cleanup";

// Player type (human or AI-controlled)
export type PlayerType = "human" | "ai";

// Player info for multiplayer (optional extension)
export type PlayerInfo = {
  id: string;
  name: string;
  type: PlayerType;
  connected?: boolean;
};

// Turn sub-phases for handling interruptions (attacks, reactions, etc.)
export type TurnSubPhase = "opponent_decision" | "awaiting_reaction" | null;

// Re-export decision types from pending-choice
export type {
  PendingChoice,
  DecisionChoice,
  CardAction,
  CardActionId,
} from "./pending-choice";
export { isDecisionChoice, isReactionChoice } from "./pending-choice";

// Log entry types with recursive children support
export type LogEntry =
  | {
      type: "turn-start";
      turn: number;
      playerId: PlayerId;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "turn-end";
      playerId: PlayerId;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "phase-change";
      playerId: PlayerId;
      phase: Phase;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "play-treasure";
      playerId: PlayerId;
      card: CardName;
      coins: number;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "unplay-treasure";
      playerId: PlayerId;
      card: CardName;
      coins: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "play-action";
      playerId: PlayerId;
      card: CardName;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "buy-card";
      playerId: PlayerId;
      card: CardName;
      vp?: number;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "draw-cards";
      playerId: PlayerId;
      count: number;
      cards?: CardName[];
      cardCounts?: Record<string, number>; // For aggregated display
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "gain-card";
      playerId: PlayerId;
      card: CardName;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "discard-cards";
      playerId: PlayerId;
      count: number;
      cards?: CardName[];
      cardCounts?: Record<string, number>; // For aggregated display
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "trash-card";
      playerId: PlayerId;
      card?: CardName;
      cards?: CardName[];
      count?: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "shuffle-deck";
      playerId: PlayerId;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "end-turn";
      playerId: PlayerId;
      nextPlayerId: PlayerId;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "game-over";
      scores: Record<string, number>;
      winner: PlayerId;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "start-game";
      playerId: PlayerId;
      coppers: number;
      estates: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "text";
      message: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "get-actions";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "get-buys";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "use-actions";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "use-buys";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "get-coins";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "spend-coins";
      playerId: PlayerId;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    };

export type PlayerState = {
  deck: CardName[];
  hand: CardName[];
  discard: CardName[];
  inPlay: CardName[];
  inPlaySourceIndices: number[]; // tracks original hand index for each inPlay card
  deckTopRevealed?: boolean; // true when top card is known (e.g. from Bureaucrat)
};

// Action history entry (subset of Action without reasoning)
export type TurnAction = {
  type:
    | "play_action"
    | "play_treasure"
    | "buy_card"
    | "end_phase"
    | "discard_card"
    | "trash_card"
    | "gain_card";
  card?: CardName | null;
};

export type GameState = {
  turn: number;
  phase: Phase;
  activePlayerId: PlayerId;

  // Single-player mode: { human, ai }
  // Multiplayer mode: { player0, player1, player2?, player3? }
  // Partial record to allow 2-4 players
  players: Record<PlayerId, PlayerState>;

  supply: Record<CardName, number>;
  trash: CardName[];
  kingdomCards: CardName[];

  actions: number;
  buys: number;
  coins: number;

  pendingChoice: PendingChoice | null;
  pendingChoiceEventId: string | null; // Event ID that created pendingChoice (for causality)

  gameOver: boolean;
  winnerId: PlayerId | null;

  log: LogEntry[];
  turnHistory: TurnAction[]; // Actions taken this turn (reset on cleanup)

  // Active effects (cost reductions, etc.) cleared at turn end
  activeEffects: Array<{
    type: "EFFECT_REGISTERED";
    playerId: PlayerId;
    effectType: "cost_reduction";
    source: CardName;
    parameters: { amount: number };
  }>;

  // Player tracking
  playerOrder: PlayerId[]; // Turn order for N-player games (always set by GAME_INITIALIZED)
  playerInfo?: Record<PlayerId, PlayerInfo>; // Player names, types, connection status
  isMultiplayer?: boolean; // Flag to indicate multiplayer mode
};

export type HumanChoice = {
  selectedCards: CardName[];
};
