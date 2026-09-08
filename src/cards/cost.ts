import { CARDS } from "../data/cards";
import type { CardName, GameState } from "../types/game-state";

/** The current cost applies in every zone, including cards being upgraded. */
export function getCardCost(
  state: Pick<GameState, "activeEffects">,
  card: CardName,
): {
  baseCost: number;
  modifiedCost: number;
  modifiers: Array<{ source: CardName; delta: number }>;
} {
  const baseCost = CARDS[card].cost;
  const modifiers = state.activeEffects
    .filter(effect => effect.effectType === "cost_reduction")
    .map(effect => ({
      source: effect.source,
      delta: -effect.parameters.amount,
    }));
  const modifiedCost = Math.max(
    0,
    baseCost + modifiers.reduce((sum, modifier) => sum + modifier.delta, 0),
  );
  return { baseCost, modifiedCost, modifiers };
}
