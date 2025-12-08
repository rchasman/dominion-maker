import { z } from "zod";

// Card names for base game
export const CardName = z.enum([
  // Treasures
  "Copper",
  "Silver",
  "Gold",
  // Victory
  "Estate",
  "Duchy",
  "Province",
  // Curse
  "Curse",
  // Kingdom cards (base game 2nd edition)
  "Cellar",
  "Chapel",
  "Moat",
  "Harbinger",
  "Merchant",
  "Vassal",
  "Village",
  "Workshop",
  "Bureaucrat",
  "Gardens",
  "Militia",
  "Moneylender",
  "Poacher",
  "Remodel",
  "Smithy",
  "Throne Room",
  "Bandit",
  "Council Room",
  "Festival",
  "Laboratory",
  "Library",
  "Market",
  "Mine",
  "Sentry",
  "Witch",
  "Artisan",
]);
export type CardName = z.infer<typeof CardName>;

export const Phase = z.enum(["action", "buy", "cleanup"]);
export type Phase = z.infer<typeof Phase>;

// Player identifiers
// For single-player: "human" vs "ai"
// For multiplayer: "player0", "player1", etc.
export const Player = z.enum(["human", "ai", "player0", "player1", "player2", "player3"]);
export type Player = z.infer<typeof Player>;

// Player type (human or AI-controlled)
export const PlayerType = z.enum(["human", "ai"]);
export type PlayerType = z.infer<typeof PlayerType>;

// Player info for multiplayer (optional extension)
export const PlayerInfo = z.object({
  id: z.string(),
  name: z.string(),
  type: PlayerType,
  connected: z.boolean().optional(),
});
export type PlayerInfo = z.infer<typeof PlayerInfo>;

// Turn sub-phases for handling interruptions (attacks, reactions, etc.)
export const TurnSubPhase = z.enum(["opponent_decision", "waiting_for_reactions"]).nullable();
export type TurnSubPhase = z.infer<typeof TurnSubPhase>;

// Decision types (moved here to break circular dependency with events/types)
export type DecisionRequest = {
  type: "select_cards";
  player: string; // PlayerId
  from: "hand" | "supply" | "revealed" | "options" | "discard";
  prompt: string;
  cardOptions?: CardName[];
  min: number;
  max: number;
  cardBeingPlayed: CardName;
  stage?: string;
  canSkip?: boolean;
  metadata?: Record<string, unknown>;
};

export type DecisionChoice = {
  selectedCards: CardName[];
};

// Zod schema for DecisionRequest
export const DecisionRequestSchema = z.object({
  type: z.literal("select_cards"),
  player: z.string(),
  from: z.enum(["hand", "supply", "revealed", "options", "discard"]),
  prompt: z.string(),
  cardOptions: z.array(z.string()).optional(),
  min: z.number(),
  max: z.number(),
  cardBeingPlayed: z.string(),
  stage: z.string().optional(),
  canSkip: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Log entry types with recursive children support
export type LogEntry = {
  type: "turn-start";
  turn: number;
  player: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "turn-end";
  player: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "phase-change";
  player: string;
  phase: Phase;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "play-treasure";
  player: string;
  card: CardName;
  coins: number;
  reasoning?: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "unplay-treasure";
  player: string;
  card: CardName;
  coins: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "play-action";
  player: string;
  card: CardName;
  reasoning?: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "buy-card";
  player: string;
  card: CardName;
  vp?: number;
  reasoning?: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "draw-cards";
  player: string;
  count: number;
  cards?: CardName[];
  cardCounts?: Record<string, number>; // For aggregated display
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "gain-card";
  player: string;
  card: CardName;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "discard-cards";
  player: string;
  count: number;
  cards?: CardName[];
  cardCounts?: Record<string, number>; // For aggregated display
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "trash-card";
  player: string;
  card?: CardName;
  cards?: CardName[];
  count?: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "shuffle-deck";
  player: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "end-turn";
  player: string;
  nextPlayer: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "game-over";
  humanVP: number;
  aiVP: number;
  winner: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "start-game";
  player: string;
  coppers: number;
  estates: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "text";
  message: string;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "get-actions";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "get-buys";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "use-actions";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "use-buys";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "get-coins";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
} | {
  type: "spend-coins";
  player: string;
  count: number;
  eventId?: string;
  children?: LogEntry[];
};

// Zod schema for runtime validation
const LogEntrySchema: z.ZodType<LogEntry> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("turn-start"),
      turn: z.number(),
      player: z.string(),
      eventId: z.string().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("turn-end"),
      player: z.string(),
      eventId: z.string().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("phase-change"),
      player: z.string(),
      phase: Phase,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("play-treasure"),
      player: z.string(),
      card: CardName,
      coins: z.number(),
      eventId: z.string().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("unplay-treasure"),
      player: z.string(),
      card: CardName,
      coins: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("play-action"),
      player: z.string(),
      card: CardName,
      eventId: z.string().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("buy-card"),
      player: z.string(),
      card: CardName,
      vp: z.number().optional(),
      eventId: z.string().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("draw-cards"),
      player: z.string(),
      count: z.number(),
      cards: z.array(CardName).optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("gain-card"),
      player: z.string(),
      card: CardName,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("discard-cards"),
      player: z.string(),
      count: z.number(),
      cards: z.array(CardName).optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("trash-card"),
      player: z.string(),
      card: CardName,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("shuffle-deck"),
      player: z.string(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("end-turn"),
      player: z.string(),
      nextPlayer: z.string(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("game-over"),
      humanVP: z.number(),
      aiVP: z.number(),
      winner: z.string(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("start-game"),
      player: z.string(),
      coppers: z.number(),
      estates: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("text"),
      message: z.string(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("get-actions"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("get-buys"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("use-actions"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("use-buys"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("get-coins"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("spend-coins"),
      player: z.string(),
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
  ])
);

export const LogEntry = LogEntrySchema;

export const PlayerState = z.object({
  deck: z.array(CardName),
  hand: z.array(CardName),
  discard: z.array(CardName),
  inPlay: z.array(CardName),
  inPlaySourceIndices: z.array(z.number()), // tracks original hand index for each inPlay card
  deckTopRevealed: z.boolean().optional(), // true when top card is known (e.g. from Bureaucrat)
});
export type PlayerState = z.infer<typeof PlayerState>;

// Action history entry (subset of Action without reasoning)
export const TurnAction = z.object({
  type: z.enum([
    "play_action",
    "play_treasure",
    "buy_card",
    "end_phase",
    "discard_card",
    "trash_card",
    "gain_card",
  ]),
  card: CardName.nullish(),
});
export type TurnAction = z.infer<typeof TurnAction>;

export const GameState = z.object({
  turn: z.number(),
  phase: Phase,
  subPhase: TurnSubPhase,
  activePlayer: z.string(),

  // Single-player mode: { human, ai }
  // Multiplayer mode: { player0, player1, player2?, player3? }
  // Partial record to allow 2-4 players
  players: z.record(z.string(), PlayerState),

  supply: z.record(z.string(), z.number()),
  trash: z.array(CardName),
  kingdomCards: z.array(CardName),

  actions: z.number(),
  buys: z.number(),
  coins: z.number(),

  pendingDecision: DecisionRequestSchema.nullable(),

  gameOver: z.boolean(),
  winner: z.string().nullable(),

  log: z.array(LogEntry),
  turnHistory: z.array(TurnAction), // Actions taken this turn (reset on cleanup)

  // Multiplayer extensions (optional for single-player)
  playerOrder: z.array(z.string()).optional(), // Turn order for N-player games
  playerInfo: z.record(z.string(), PlayerInfo).optional(), // Player names, types, connection status
  isMultiplayer: z.boolean().optional(), // Flag to indicate multiplayer mode
});

// Override the inferred type to use DecisionRequest
type BaseGameState = z.infer<typeof GameState>;
export type GameState = Omit<BaseGameState, 'pendingDecision'> & {
  pendingDecision: DecisionRequest | null;
};

export const HumanChoice = z.object({
  selectedCards: z.array(CardName),
});
export type HumanChoice = z.infer<typeof HumanChoice>;
