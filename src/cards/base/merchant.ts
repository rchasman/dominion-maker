/**
 * Merchant - +1 Card, +1 Action. First Silver you play this turn: +$1
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const merchant: CardEffect = ({ state, playerId }): CardEffectResult => {
  const drawEvents = createDrawEvents(playerId, state.players[playerId]!, 1);
  const actionEvents: GameEvent[] = [{ type: "ACTIONS_MODIFIED", delta: 1 }];
  // The +$1 for Silver is tracked by the engine during buy phase
  return { events: [...drawEvents, ...actionEvents] };
};
