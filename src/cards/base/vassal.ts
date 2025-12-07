/**
 * Vassal - +$2. Discard top card. If it's an Action, you may play it
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { peekDraw, isActionCard } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const vassal: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [{ type: "COINS_MODIFIED", delta: 2 }];

  // Initial: +$2, reveal and discard top card
  if (!decision || stage === undefined) {
    const { cards: revealed } = peekDraw(playerState, 1);

    if (revealed.length === 0) {
      return { events };
    }

    const topCard = revealed[0];
    events.push({ type: "CARD_DISCARDED", player, card: topCard, from: "deck" });

    // If it's an action, offer to play it
    if (isActionCard(topCard)) {
      return {
        events,
        pendingDecision: {
          type: "select_cards",
          player,
          from: "options",
          prompt: `Vassal: Play ${topCard} from discard?`,
          cardOptions: [topCard],
          min: 0,
          max: 1,
          cardBeingPlayed: "Vassal",
          stage: "play_action",
          metadata: { discardedCard: topCard },
        },
      };
    }

    return { events };
  }

  // Play the action from discard
  if (stage === "play_action") {
    // Note: The actual playing of the action card is handled by the engine
    // This just signals the intent
    if (decision.selectedCards.length > 0) {
      const cardToPlay = decision.selectedCards[0];
      // Move from discard to play area (the effect will be executed by engine)
      events.push({ type: "CARD_PLAYED", player, card: cardToPlay });
    }
    return { events };
  }

  return { events: [] };
};
