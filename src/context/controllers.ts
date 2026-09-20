import type { Controller } from "../core/controller";
import { heuristicController } from "../core/controller";
import { llmController, type DecideMove } from "../core/llm-controller";
import { createControllerCache } from "../core/controller-cache";
import type { GameShape } from "../core/game-definition";
import type { GameModule } from "../core/game-module";
import type { ControllerConfig } from "../core/seats";
import type { LLMLogger } from "../core/consensus/types";

/** Everything a controller needs from the app that the core must not reach for itself */
type ControllerTransport<G extends GameShape> = {
  decideMove: DecideMove<G>;
  verifyMove?: (
    state: G["state"],
    move: G["move"],
    actionId: string,
    customStrategy: string,
  ) => void;
  getPlayerStrategies: () => Record<string, unknown>;
};

/** Browser controllers: the rules bot, or LLM consensus through the supplied transport */
export function createBrowserControllers<G extends GameShape>(
  module: GameModule<G>,
  logger: LLMLogger,
  deps: ControllerTransport<G>,
): (config: ControllerConfig, player: G["playerId"]) => Controller<G> | null {
  return createControllerCache<G>(config => {
    if (config.kind === "human") return null;
    if (config.kind === "heuristic")
      return heuristicController(module.definition);
    return llmController(module.definition, config, {
      decideMove: deps.decideMove,
      logger,
      getPlayerStrategies: deps.getPlayerStrategies,
      ...(deps.verifyMove ? { verifyMove: deps.verifyMove } : {}),
    });
  });
}
