import type { PlayerId } from "./game-state";

export interface PlayerStrategy {
  analysis?: import("../agent/analysis-version").AnalysisVersion;
  gameplan: string;
  read: string;
  recommendation: string;
}

export type PlayerStrategyData = Record<PlayerId, PlayerStrategy>;
