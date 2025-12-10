/**
 * Witch - +2 Cards. Each other player gains a Curse
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";

const CARDS_TO_DRAW = 2;

export const witch: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = createDrawEvents(
    player,
    state.players[player],
    CARDS_TO_DRAW,
  );
  const opponents = getOpponents(state, player);

  // Each opponent gains a Curse if available
  const curseEvents = opponents
    .filter(() => state.supply.Curse > 0)
    .map(opp => ({
      type: "CARD_GAINED" as const,
      player: opp,
      card: "Curse" as const,
      to: "discard" as const,
    }));

  events.push(...curseEvents);

  return { events };
};
