export interface PlayerStrategy {
  gameplan: string;
  read: string;
  recommendation: string;
}

export type PlayerStrategyData = Record<string, PlayerStrategy>;
