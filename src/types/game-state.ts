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
});
export type PlayerState = z.infer<typeof PlayerState>;

export const PendingDecision = z.object({
  type: DecisionType,
  player: Player,
  prompt: z.string(),
  options: z.array(CardName),
  minCount: z.number().optional(),
  maxCount: z.number().optional(),
  canSkip: z.boolean().optional(),
});
export type PendingDecision = z.infer<typeof PendingDecision>;

export const GameState = z.object({
  turn: z.number(),
  phase: Phase,
  activePlayer: Player,

  players: z.object({
    human: PlayerState,
    ai: PlayerState,
  }),

  supply: z.record(CardName, z.number()),
  trash: z.array(CardName),
  kingdomCards: z.array(CardName),

  actions: z.number(),
  buys: z.number(),
  coins: z.number(),

  pendingDecision: PendingDecision.nullable(),

  gameOver: z.boolean(),
  winner: Player.nullable(),

  log: z.array(z.string()),
});
export type GameState = z.infer<typeof GameState>;

export const HumanChoice = z.object({
  selectedCards: z.array(CardName),
});
export type HumanChoice = z.infer<typeof HumanChoice>;
