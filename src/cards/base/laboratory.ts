/**
 * Laboratory - +2 Cards, +1 Action
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const laboratory: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 2),
    { type: "ACTIONS_MODIFIED", delta: 1 },
  ];
  return { events };
};
