/**
 * Council Room - +4 Cards, +1 Buy, each other player draws a card
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const councilRoom: CardEffect = ({
  state,
  player,
}): CardEffectResult => {
  const events: GameEvent[] = createDrawEvents(
    player,
    state.players[player],
    4,
  );
  events.push({ type: "BUYS_MODIFIED", delta: 1 });

  // Each opponent draws a card
  const playerOrder = state.playerOrder || ["human", "ai"];
  for (const opponent of playerOrder) {
    if (opponent !== player && state.players[opponent]) {
      events.push(...createDrawEvents(opponent, state.players[opponent], 1));
    }
  }

  return { events };
};
