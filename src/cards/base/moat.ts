/**
 * Moat - +2 Cards (Reaction: reveal to be unaffected by attack)
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";

export const moat: CardEffect = ({ state, player }) => {
  const events = createDrawEvents(player, state.players[player], 2);
  return { events };
};
