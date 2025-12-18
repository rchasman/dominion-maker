/**
 * Harbinger - +1 Card, +1 Action. Look through discard, may put a card on deck
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import { STAGES } from "../stages";

export const harbinger: CardEffect = ({
  state,
  playerId,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[playerId]!;

  // Initial: +1 Card, +1 Action
  if (!decision || stage === undefined) {
    const drawEvents = createDrawEvents(playerId, playerState, 1);
    const actionEvents = [{ type: "ACTIONS_MODIFIED" as const, delta: 1 }];
    const events = [...drawEvents, ...actionEvents];

    // If discard pile is empty, we're done
    if (playerState.discard.length === 0) {
      return { events };
    }

    return {
      events,
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "discard",
        prompt:
          "Harbinger: Put a card from your discard onto your deck (or skip)",
        cardOptions: [...playerState.discard],
        min: 0,
        max: 1,
        cardBeingPlayed: "Harbinger",
        stage: STAGES.TOPDECK,
      },
    };
  }

  // Put card on deck
  if (stage === STAGES.TOPDECK) {
    const events =
      decision.selectedCards.length > 0
        ? [
            {
              type: "CARD_PUT_ON_DECK" as const,
              playerId,
              card: decision.selectedCards[0],
              from: "discard" as const,
            },
          ]
        : [];
    return { events };
  }

  return { events: [] };
};
