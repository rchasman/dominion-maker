/**
 * Market - +1 Card, +1 Action, +1 Buy, +$1
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const market: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 1),
    { type: "ACTIONS_MODIFIED", delta: 1 },
    { type: "BUYS_MODIFIED", delta: 1 },
    { type: "COINS_MODIFIED", delta: 1 },
  ];
  return { events };
};
