/**
 * Witch - +2 Cards. Each other player gains a Curse
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const witch: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = createDrawEvents(
    player,
    state.players[player],
    2,
  );
  const opponents = getOpponents(state, player);

  // Each opponent gains a Curse if available
  for (const opp of opponents) {
    if (state.supply.Curse > 0) {
      events.push({
        type: "CARD_GAINED",
        player: opp,
        card: "Curse",
        to: "discard",
      });
    }
  }

  return { events };
};
