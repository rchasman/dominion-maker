/**
 * Festival - +2 Actions, +1 Buy, +$2
 */

import type { CardEffect } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const festival: CardEffect = () => {
  const events: GameEvent[] = [
    { type: "ACTIONS_MODIFIED", delta: 2 },
    { type: "BUYS_MODIFIED", delta: 1 },
    { type: "COINS_MODIFIED", delta: 2 },
  ];
  return { events };
};
