import type { GameDefinition, GameShape, EngineOf } from "./game-definition";

export interface Controller<G extends GameShape> {
  decide(
    engine: EngineOf<G>,
    player: G["playerId"],
    signal: AbortSignal,
  ): Promise<G["command"]>;
}

export function heuristicController<G extends GameShape>(
  game: GameDefinition<G>,
): Controller<G> {
  const heuristic = game.heuristic?.bind(game);
  if (!heuristic) {
    throw new Error(`${game.id} has no heuristic controller`);
  }
  return {
    decide: (engine, player) =>
      Promise.resolve(heuristic(engine.state, player)),
  };
}
