/**
 * Witch - +2 Cards. Each other player gains a Curse
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import type { GameEvent } from "../../events/types";

const CARDS_TO_DRAW = 2;

export const witch: CardEffect = ({
  player,
  attackTargets = [],
}): CardEffectResult => {
  const events: GameEvent[] = [{ type: "DRAW", player, count: CARDS_TO_DRAW }];

  // Engine auto-handles reactions, provides resolved targets
  const curseEvents: GameEvent[] = attackTargets.map(target => ({
    type: "CARD_GAINED" as const,
    player: target,
    card: "Curse" as const,
    to: "discard" as const,
  }));

  return { events: [...events, ...curseEvents] };
};
