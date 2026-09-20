import type { TokenUsage } from "./consensus/cost";
import type { WeightedVote } from "./consensus/types";
import type { Engine } from "./engine";

export type GameShape = {
  state: unknown;
  event: unknown;
  command: unknown;
  move: unknown;
  playerId: string;
};

export type EngineOf<G extends GameShape> = Engine<
  G["state"],
  G["event"],
  G["command"],
  G["playerId"]
>;

export type LogContext = {
  /** A new value opens a new turn group in the consensus viewer */
  turnId: string;
  /** True while answering a pending choice */
  isChoice: boolean;
  /** What the viewer renders for this decision */
  payload: Record<string, unknown>;
};

export type PromptInput<G extends GameShape> = {
  state: G["state"];
  player: G["playerId"];
  moves: G["move"][];
  playerStrategies: Record<string, unknown>;
  customStrategy: string;
};

export type EvaluateInput<G extends GameShape> = PromptInput<G> & {
  modelId: string;
};

/** A decision answered by several votes and one command */
export type CompoundDecision<G extends GameShape> = {
  round(picks: G["move"][]): { state: G["state"]; moves: G["move"][] } | null;
  endsRounds(move: G["move"]): boolean;
  finish(picks: G["move"][]): G["command"];
};

export interface GameDefinition<G extends GameShape> {
  id: string;
  whoMustAct(state: G["state"]): G["playerId"] | null;
  players(state: G["state"]): G["playerId"][];
  legalMoves(state: G["state"], player: G["playerId"]): G["move"][];
  /** A move so obvious the models are not asked */
  autoMove?(
    state: G["state"],
    player: G["playerId"],
    moves: G["move"][],
  ): G["move"] | undefined;
  moveToCommand(
    state: G["state"],
    move: G["move"],
    player: G["playerId"],
  ): G["command"];
  moveKey(move: G["move"]): string;
  describeMove(move: G["move"]): string;
  /** One row of the numbered table the models pick from */
  promptRow(move: G["move"]): Record<string, string | number>;
  prompt(input: PromptInput<G>): { system: string; user: string };
  logContext(
    state: G["state"],
    player: G["playerId"],
    moves: G["move"][],
  ): LogContext;
  compound?(
    state: G["state"],
    player: G["playerId"],
  ): CompoundDecision<G> | null;
  evaluate?(input: EvaluateInput<G>): Promise<{
    move: G["move"];
    distribution: WeightedVote<G["move"]>[];
    usage: TokenUsage;
  }>;
  heuristic?(state: G["state"], player: G["playerId"]): G["command"];
}
