import type { DominionEngine } from "../engine";
import type { GameState } from "./game-state";

/**
 * Game modes
 * - engine: Simple random AI
 * - llm: LLM-powered AI with consensus voting
 * - hybrid: Mix of LLM and simple AI
 * - multiplayer: P2P multiplayer mode
 */
export type GameMode = "engine" | "llm" | "hybrid" | "multiplayer";

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
  runAITurn(engine: DominionEngine, onStateChange?: (state: GameState) => void): Promise<void>;

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
