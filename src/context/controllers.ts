import type { Controller } from "../core/controller";
import { heuristicController } from "../core/controller";
import { llmController } from "../core/llm-controller";
import { createControllerCache } from "../core/controller-cache";
import type { ControllerConfig } from "../core/seats";
import type { LLMLogger } from "../core/consensus/types";
import { dominionGame, type DominionShape } from "../dominion/definition";
import { reasoningOf } from "../dominion/moves";
import { httpDecideMove, httpVerifyMove } from "../agent/http-decide-move";
import { playerStrategies$ } from "./game-signals";

/** Browser controllers: the rules bot, or LLM consensus through the same-origin API */
export function createBrowserControllers(
  logger: LLMLogger,
): (
  config: ControllerConfig,
  player: string,
) => Controller<DominionShape> | null {
  return createControllerCache<DominionShape>(config => {
    if (config.kind === "human") return null;
    if (config.kind === "heuristic") return heuristicController(dominionGame);
    return llmController(dominionGame, config, {
      decideMove: httpDecideMove(),
      logger,
      getPlayerStrategies: () => playerStrategies$.peek(),
      verifyMove: httpVerifyMove("", logger),
      reasoningOf,
    });
  });
}
