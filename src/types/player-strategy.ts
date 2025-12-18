import type { PlayerId } from "./game-state";

export interface PlayerStrategy {
  gameplan: string;
  read: string;
  recommendation: string;
}

export type PlayerStrategyData = Record<PlayerId, PlayerStrategy>;
