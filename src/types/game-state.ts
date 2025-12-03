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

export const Player = z.enum(["human", "ai"]);
export type Player = z.infer<typeof Player>;

// Turn sub-phases for handling interruptions (attacks, reactions, etc.)
export const TurnSubPhase = z.enum(["opponent_decision", "waiting_for_reactions"]).nullable();
export type TurnSubPhase = z.infer<typeof TurnSubPhase>;

// Log entry types with recursive children support
export type LogEntry = {
  type: "turn-start";
  turn: number;
  player: Player;
  children?: LogEntry[];
} | {
  type: "phase-change";
  player: Player;
  phase: Phase;
  children?: LogEntry[];
} | {
  type: "play-treasure";
  player: Player;
  card: CardName;
  coins: number;
  children?: LogEntry[];
} | {
  type: "unplay-treasure";
  player: Player;
  card: CardName;
  coins: number;
  children?: LogEntry[];
} | {
  type: "play-action";
  player: Player;
  card: CardName;
  children?: LogEntry[];
} | {
  type: "buy-card";
  player: Player;
  card: CardName;
  vp?: number;
  children?: LogEntry[];
} | {
  type: "draw-cards";
  player: Player;
  count: number;
  cards?: CardName[];
  children?: LogEntry[];
} | {
  type: "gain-card";
  player: Player;
  card: CardName;
  children?: LogEntry[];
} | {
  type: "discard-cards";
  player: Player;
  count: number;
  cards?: CardName[];
  children?: LogEntry[];
} | {
  type: "trash-card";
  player: Player;
  card: CardName;
  children?: LogEntry[];
} | {
  type: "shuffle-deck";
  player: Player;
  children?: LogEntry[];
} | {
  type: "end-turn";
  player: Player;
  nextPlayer: Player;
  children?: LogEntry[];
} | {
  type: "game-over";
  humanVP: number;
  aiVP: number;
  winner: Player;
  children?: LogEntry[];
} | {
  type: "start-game";
  player: Player;
  coppers: number;
  estates: number;
  children?: LogEntry[];
} | {
  type: "text";
  message: string;
  children?: LogEntry[];
} | {
  type: "get-actions";
  player: Player;
  count: number;
  children?: LogEntry[];
} | {
  type: "get-buys";
  player: Player;
  count: number;
  children?: LogEntry[];
} | {
  type: "get-coins";
  player: Player;
  count: number;
  children?: LogEntry[];
};

// Zod schema for runtime validation
const LogEntrySchema: z.ZodType<LogEntry> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("turn-start"),
      turn: z.number(),
      player: Player,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("phase-change"),
      player: Player,
      phase: Phase,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("play-treasure"),
      player: Player,
      card: CardName,
      coins: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("unplay-treasure"),
      player: Player,
      card: CardName,
      coins: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("play-action"),
      player: Player,
      card: CardName,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("buy-card"),
      player: Player,
      card: CardName,
      vp: z.number().optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("draw-cards"),
      player: Player,
      count: z.number(),
      cards: z.array(CardName).optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("gain-card"),
      player: Player,
      card: CardName,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("discard-cards"),
      player: Player,
      count: z.number(),
      cards: z.array(CardName).optional(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("trash-card"),
      player: Player,
      card: CardName,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("shuffle-deck"),
      player: Player,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("end-turn"),
      player: Player,
      nextPlayer: Player,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("game-over"),
      humanVP: z.number(),
      aiVP: z.number(),
      winner: Player,
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("start-game"),
      player: Player,
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
      player: Player,
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("get-buys"),
      player: Player,
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
    z.object({
      type: z.literal("get-coins"),
      player: Player,
      count: z.number(),
      children: z.array(LogEntrySchema).optional(),
    }),
  ])
);

export const LogEntry = LogEntrySchema;

export const DecisionType = z.enum([
  "play_action",
  "buy_card",
  "discard",
  "trash",
  "gain",
  "end_actions",
  "end_buys",
  "reveal_reaction",
  "choose_card_from_options",
]);
export type DecisionType = z.infer<typeof DecisionType>;

export const PlayerState = z.object({
  deck: z.array(CardName),
  hand: z.array(CardName),
  discard: z.array(CardName),
  inPlay: z.array(CardName),
  inPlaySourceIndices: z.array(z.number()), // tracks original hand index for each inPlay card
});
export type PlayerState = z.infer<typeof PlayerState>;

export const PendingDecision = z.object({
  type: DecisionType,
  player: Player,
  prompt: z.string(),
  options: z.array(z.union([CardName, z.string()])),
  minCount: z.number().optional(),
  maxCount: z.number().optional(),
  canSkip: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type PendingDecision = z.infer<typeof PendingDecision>;

export const GameState = z.object({
  turn: z.number(),
  phase: Phase,
  subPhase: TurnSubPhase,
  activePlayer: Player,

  players: z.object({
    human: PlayerState,
    ai: PlayerState,
  }),

  supply: z.record(z.string(), z.number()),
  trash: z.array(CardName),
  kingdomCards: z.array(CardName),

  actions: z.number(),
  buys: z.number(),
  coins: z.number(),

  pendingDecision: PendingDecision.nullable(),

  gameOver: z.boolean(),
  winner: Player.nullable(),

  log: z.array(LogEntry),
});
export type GameState = z.infer<typeof GameState>;

export const HumanChoice = z.object({
  selectedCards: z.array(CardName),
});
export type HumanChoice = z.infer<typeof HumanChoice>;
