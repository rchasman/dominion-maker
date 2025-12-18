// Card names for base game
export type CardName =
  // Treasures
  | "Copper"
  | "Silver"
  | "Gold"
  // Victory
  | "Estate"
  | "Duchy"
  | "Province"
  // Curse
  | "Curse"
  // Kingdom cards (base game 2nd edition)
  | "Cellar"
  | "Chapel"
  | "Moat"
  | "Harbinger"
  | "Merchant"
  | "Vassal"
  | "Village"
  | "Workshop"
  | "Bureaucrat"
  | "Gardens"
  | "Militia"
  | "Moneylender"
  | "Poacher"
  | "Remodel"
  | "Smithy"
  | "Throne Room"
  | "Bandit"
  | "Council Room"
  | "Festival"
  | "Laboratory"
  | "Library"
  | "Market"
  | "Mine"
  | "Sentry"
  | "Witch"
  | "Artisan";

export type Phase = "action" | "buy" | "cleanup";

// Player identifiers
// For single-player: "human" vs "ai"
// For multiplayer: "player0", "player1", etc.
export type Player = string; // ClientId strings

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

// Decision types (moved here to break circular dependency with events/types)

export type CardActionId =
  | "trash_card"
  | "discard_card"
  | "topdeck_card"
  | "gain_card";

export type CardAction = {
  id: CardActionId;
  label: string;
  color: string;
  isDefault?: boolean;
};

export type DecisionRequest = {
  type: "card_decision";
  playerId: string;
  prompt: string;
  cardOptions: CardName[];
  cardBeingPlayed: CardName;

  // Simple selection mode (when actions is not provided)
  from?: "hand" | "supply" | "revealed" | "options" | "discard";
  min?: number;
  max?: number;
  stage?: string;

  // Complex multi-action mode (when actions is provided)
  actions?: CardAction[]; // Available actions per card (trash, discard, topdeck, etc.)
  requiresOrdering?: boolean; // True if cards need to be ordered
  orderingPrompt?: string;

  metadata?: Record<string, unknown>;
};

export type DecisionChoice = {
  selectedCards: CardName[];
  cardActions?: Record<string | number, string>; // Map of card name/index to action id
  cardOrder?: (CardName | number)[]; // Ordered list of cards or indices (for ordering decisions)
};

// Log entry types with recursive children support
export type LogEntry =
  | {
      type: "turn-start";
      turn: number;
      player: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "turn-end";
      player: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "phase-change";
      player: string;
      phase: Phase;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "play-treasure";
      player: string;
      card: CardName;
      coins: number;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "unplay-treasure";
      player: string;
      card: CardName;
      coins: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "play-action";
      player: string;
      card: CardName;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "buy-card";
      player: string;
      card: CardName;
      vp?: number;
      reasoning?: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "draw-cards";
      player: string;
      count: number;
      cards?: CardName[];
      cardCounts?: Record<string, number>; // For aggregated display
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "gain-card";
      player: string;
      card: CardName;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "discard-cards";
      player: string;
      count: number;
      cards?: CardName[];
      cardCounts?: Record<string, number>; // For aggregated display
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "trash-card";
      player: string;
      card?: CardName;
      cards?: CardName[];
      count?: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "shuffle-deck";
      player: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "end-turn";
      player: string;
      nextPlayer: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "game-over";
      scores: Record<string, number>;
      winner: string;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "start-game";
      player: string;
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
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "get-buys";
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "use-actions";
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "use-buys";
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "get-coins";
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    }
  | {
      type: "spend-coins";
      player: string;
      count: number;
      eventId?: string;
      children?: LogEntry[];
    };

// Reaction Request (first-class, separate from decisions)
export type ReactionRequest = {
  playerId: string; // The player who can react (unified with DecisionRequest)
  attacker: string;
  attackCard: CardName;
  availableReactions: CardName[];
  metadata: {
    allTargets: string[];
    currentTargetIndex: number;
    blockedTargets: string[];
    originalCause: string;
  };
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
  activePlayer: string;

  // Single-player mode: { human, ai }
  // Multiplayer mode: { player0, player1, player2?, player3? }
  // Partial record to allow 2-4 players
  players: Record<string, PlayerState>;

  supply: Record<string, number>;
  trash: CardName[];
  kingdomCards: CardName[];

  actions: number;
  buys: number;
  coins: number;

  pendingDecision: DecisionRequest | null;
  pendingDecisionEventId: string | null; // Event ID that created pendingDecision (for causality)

  pendingReaction: ReactionRequest | null;
  pendingReactionEventId: string | null; // Event ID that created pendingReaction (for causality)

  gameOver: boolean;
  winner: string | null;

  log: LogEntry[];
  turnHistory: TurnAction[]; // Actions taken this turn (reset on cleanup)

  // Active effects (cost reductions, etc.) cleared at turn end
  activeEffects: Array<{
    type: "EFFECT_REGISTERED";
    player: string;
    effectType: "cost_reduction";
    source: CardName;
    parameters: { amount: number };
  }>;

  // Player tracking
  playerOrder: string[]; // Turn order for N-player games (always set by GAME_INITIALIZED)
  playerInfo?: Record<string, PlayerInfo>; // Player names, types, connection status
  isMultiplayer?: boolean; // Flag to indicate multiplayer mode
};

export type HumanChoice = {
  selectedCards: CardName[];
};
