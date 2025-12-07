import type { GameState, LogEntry, Player, CardName } from "../types/game-state";

export interface CardEffectContext {
  state: GameState;
  player: Player;
  children: LogEntry[];
  // For multi-stage card effects that require human decisions
  decision?: {
    stage?: string;
    selectedCards?: CardName[];
    metadata?: Record<string, unknown>;
  };
}

export type CardEffect = (ctx: CardEffectContext) => GameState;
