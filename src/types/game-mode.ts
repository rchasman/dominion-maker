import type { DominionEngine } from "../engine";
import type { GameState } from "./game-state";
import type { PlayerId } from "./game-state";
import { generateAINames } from "../lib/ai-names";

/**
 * Game modes
 * - engine: Simple random AI
 * - hybrid: Human vs AI where AI uses MAKER consensus voting
 * - full: AI vs AI where both players use MAKER consensus voting (watch mode)
 * - multiplayer: P2P multiplayer mode
 */
export type GameMode = "engine" | "hybrid" | "full" | "multiplayer";

/**
 * Configuration for each game mode
 */
export interface GameModeConfig {
  name: string;
  description: string;
  logDescription: {
    title: string;
    description: string;
  };
  players: PlayerId[] | (() => PlayerId[]);
  isAIPlayer: (playerId: PlayerId) => boolean;
}

/**
 * Get player IDs for a mode, handling both static and dynamic generation
 */
export function getPlayersForMode(
  mode: Exclude<GameMode, "multiplayer">,
): PlayerId[] {
  const config = GAME_MODE_CONFIG[mode];
  return typeof config.players === "function"
    ? config.players()
    : config.players;
}

export const GAME_MODE_CONFIG: Record<
  Exclude<GameMode, "multiplayer">,
  GameModeConfig
> = {
  engine: {
    name: "Engine",
    description: "Hard-coded rules engine with simple random AI",
    logDescription: {
      title: "Engine Mode Active",
      description: "AI uses hard-coded rules. No LLM calls are made.",
    },
    players: ["human", "ai"],
    isAIPlayer: playerId => playerId === "ai",
  },
  hybrid: {
    name: "Hybrid",
    description:
      "Human vs AI - AI opponent uses MAKER consensus voting (multiple models vote on each decision)",
    logDescription: {
      title: "Hybrid Mode Active",
      description: "Consensus decisions will appear when AI takes its turn.",
    },
    players: ["human", "ai"],
    isAIPlayer: playerId => playerId === "ai",
  },
  full: {
    name: "Full",
    description: "AI vs AI - Watch both players use MAKER consensus voting",
    logDescription: {
      title: "Full Mode Active",
      description: "Both players use MAKER consensus. Watch the game unfold.",
    },
    players: () => generateAINames(),
    isAIPlayer: () => {
      // In full mode, ALL players are AI (even "human" when switching from hybrid)
      return true;
    },
  },
};

/**
 * Convert existing players when switching to full mode
 * Preserves player identities: "human" → "player", "ai" stays as is
 */
export function convertToFullModePlayers(
  existingPlayers: PlayerId[],
): PlayerId[] {
  if (existingPlayers.length !== 2) {
    // If not exactly 2 players, generate new random names
    return getPlayersForMode("full");
  }

  const converted = existingPlayers.map(id => {
    if (id === "human") return "player";
    return id; // Keep ai, or any other existing name
  });

  return converted as PlayerId[];
}

/**
 * Strategy interface for AI behavior
 * Strategies dispatch commands to the DominionEngine
 */
export interface GameStrategy {
  /**
   * Run a full AI turn using the engine
   * @param engine - The game engine to dispatch commands to
   * @param onStateChange - Optional callback for incremental UI updates
   */
  runAITurn(
    engine: DominionEngine,
    onStateChange?: (state: GameState) => void,
  ): Promise<void>;

  /**
   * Resolve a pending decision for the AI player
   * @param engine - The game engine to dispatch commands to
   */
  resolveAIPendingDecision(engine: DominionEngine): Promise<void>;

  /**
   * Get the mode name for display
   */
  getModeName(): string;
}
