import type { Controller } from "./controller";
import type { GameShape } from "./game-definition";
import type { ControllerConfig } from "./seats";
import { sameConfig } from "./seats";

/**
 * One controller per seat, rebuilt only when that seat's config changes, so
 * a controller can keep per-seat memory (the LLM controller's turn boundary).
 */
export function createControllerCache<G extends GameShape>(
  build: (
    config: ControllerConfig,
    player: G["playerId"],
  ) => Controller<G> | null,
): (config: ControllerConfig, player: G["playerId"]) => Controller<G> | null {
  const cache = new Map<
    G["playerId"],
    { config: ControllerConfig; controller: Controller<G> | null }
  >();
  return (config, player) => {
    const hit = cache.get(player);
    if (hit && sameConfig(hit.config, config)) return hit.controller;
    const controller = build(config, player);
    cache.set(player, { config, controller });
    return controller;
  };
}
