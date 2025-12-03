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
   */
  runAITurn(state: GameState): Promise<GameState>;

  /**
   * Get the mode name for display
   */
  getModeName(): string;
}
