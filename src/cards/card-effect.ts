import type {
  GameState,
  LogEntry,
  PlayerId,
  CardName,
} from "../types/game-state";

export interface CardEffectContext {
  state: GameState;
  playerId: PlayerId;
  children: LogEntry[];
  // For multi-stage card effects that require human decisions
  decision?: {
    stage?: string;
    selectedCards?: CardName[];
    metadata?: Record<string, unknown>;
  };
}

export type CardEffect = (ctx: CardEffectContext) => GameState;
