import type { DominionEngine } from "../engine";
import type { GameState } from "./game-state";
import type { PlayerId } from "./game-state";

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
  players: PlayerId[];
  isAIPlayer: (playerId: PlayerId) => boolean;
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
    isAIPlayer: (playerId) => playerId === "ai",
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
    isAIPlayer: (playerId) => playerId === "ai",
  },
  full: {
    name: "Full",
    description: "AI vs AI - Watch both players use MAKER consensus voting",
    logDescription: {
      title: "Full Mode Active",
      description: "Both players use MAKER consensus. Watch the game unfold.",
    },
    players: ["ai1", "ai2"],
    isAIPlayer: (playerId) => playerId === "ai1" || playerId === "ai2",
  },
};

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
