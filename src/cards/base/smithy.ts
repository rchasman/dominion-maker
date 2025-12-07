/**
 * Smithy - +3 Cards
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";

export const smithy: CardEffect = ({ state, player }) => {
  const events = createDrawEvents(player, state.players[player], 3);
  return { events };
};
