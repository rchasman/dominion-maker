/**
 * Village - +1 Card, +2 Actions
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const village: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 1),
    { type: "ACTIONS_MODIFIED", delta: 2 },
  ];
  return { events };
};
