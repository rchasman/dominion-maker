/**
 * Vassal - +$2. Discard top card. If it's an Action, you may play it
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { peekDraw, isActionCard } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { STAGES } from "../stages";

export const vassal: CardEffect = ({
  state,
  playerId,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[playerId]!;

  // Initial: +$2, reveal and discard top card
  if (!decision || stage === undefined) {
    const coinEvents: GameEvent[] = [{ type: "COINS_MODIFIED", delta: 2 }];
    const { cards: revealed } = peekDraw(playerState, 1);

    if (revealed.length === 0) {
      return { events: coinEvents };
    }

    const topCard = revealed[0];
    const discardEvents: GameEvent[] = [
      {
        type: "CARD_DISCARDED",
        playerId,
        card: topCard,
        from: "deck",
      },
    ];

    // If it's an action, offer to play it
    if (isActionCard(topCard)) {
      return {
        events: [...coinEvents, ...discardEvents],
        pendingChoice: {
          choiceType: "decision",
          playerId,
          from: "options",
          prompt: `Vassal: Play ${topCard} from discard?`,
          cardOptions: [topCard],
          min: 0,
          max: 1,
          cardBeingPlayed: "Vassal",
          stage: STAGES.PLAY_ACTION,
          metadata: { discardedCard: topCard },
        },
      };
    }

    return { events: [...coinEvents, ...discardEvents] };
  }

  // Play the action from discard
  if (stage === STAGES.PLAY_ACTION) {
    // Coins already emitted in initial stage
    if (decision.selectedCards.length > 0) {
      const cardToPlay = decision.selectedCards[0];
      return {
        events: [{ type: "CARD_PLAYED", playerId, card: cardToPlay }],
      };
    }
    return { events: [] };
  }

  return { events: [] };
};
