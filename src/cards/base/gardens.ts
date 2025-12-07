/**
 * Gardens - No active effect (VP = floor(deck size / 10))
 */

import type { CardEffect, CardEffectResult } from "../effect-types";

export const gardens: CardEffect = (): CardEffectResult => {
  return { events: [] };
};
