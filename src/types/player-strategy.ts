import type { PlayerId } from "./game-state";

export interface PlayerStrategy {
  analysis?: import("../agent/analysis-version").AnalysisVersion;
  decisionPlan?: import("../agent/strategy-plan").StrategyPlan;
  gameplan: string;
  read: string;
  recommendation: string;
}

export type PlayerStrategyData = Record<PlayerId, PlayerStrategy>;
