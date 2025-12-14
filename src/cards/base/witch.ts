/**
 * Witch - +2 Cards. Each other player gains a Curse
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";

const CARDS_TO_DRAW = 2;

export const witch: CardEffect = ({
  state,
  player,
  attackTargets,
}): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = createDrawEvents(
    player,
    playerState,
    CARDS_TO_DRAW,
  );

  const targets = attackTargets ?? getOpponents(state, player);

  const curseEvents: GameEvent[] = targets.map(target => ({
    type: "CARD_GAINED" as const,
    player: target,
    card: "Curse" as const,
    to: "discard" as const,
  }));

  return { events: [...events, ...curseEvents] };
};
