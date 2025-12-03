import type { GameState, CardName } from "./game-state";

export type GameMode = "engine" | "llm" | "hybrid";

export interface GameStrategy {
  /**
   * Handle a card being played from hand
   */
  handleCardPlay(state: GameState, card: CardName): Promise<GameState>;

  /**
   * Handle buying a card from supply
   */
  handleBuyCard(state: GameState, card: CardName): Promise<GameState>;

  /**
   * Handle playing all treasures at once
   */
  handlePlayAllTreasures(state: GameState): Promise<GameState>;

  /**
   * Handle unplaying a treasure (putting it back in hand)
   */
  handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState>;

  /**
   * Handle ending the current phase
   */
  handleEndPhase(state: GameState): Promise<GameState>;

  /**
   * Run a full AI turn
   * @param onStateChange - Optional callback for incremental UI updates
   */
  runAITurn(state: GameState, onStateChange?: (state: GameState) => void): Promise<GameState>;

  /**
   * Resolve a pendingDecision for the AI player (e.g., responding to opponent's attack)
   */
  resolveAIPendingDecision(state: GameState): Promise<GameState>;

  /**
   * Get the mode name for display
   */
  getModeName(): string;
}
