/**
 * Militia - +$2. Each other player discards down to 3 cards in hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { Player } from "../../types/game-state";

export const militia: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const events: GameEvent[] = [];
  const opponents = getOpponents(state, player);

  // Initial call: +$2, then check if anyone needs to discard
  if (!decision || stage === undefined) {
    events.push({ type: "COINS_MODIFIED", delta: 2 });

    // Find first opponent who needs to discard
    for (const opp of opponents) {
      const oppState = state.players[opp];
      if (oppState && oppState.hand.length > 3) {
        const discardCount = oppState.hand.length - 3;
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: `Militia: Discard down to 3 cards (discard ${discardCount})`,
            cardOptions: [...oppState.hand],
            min: discardCount,
            max: discardCount,
            cardBeingPlayed: "Militia",
            stage: "opponent_discard",
            metadata: {
              remainingOpponents: opponents.filter(o => o !== opp),
              attackingPlayer: player,
            },
          },
        };
      }
    }

    // No one needs to discard
    return { events };
  }

  // Process opponent discard
  if (stage === "opponent_discard" && decision) {
    const toDiscard = decision.selectedCards || [];
    const discardingPlayer = state.pendingDecision?.player as Player;

    // Discard (atomic events)
    for (const card of toDiscard) {
      events.push({
        type: "CARD_DISCARDED",
        player: discardingPlayer,
        card,
        from: "hand",
      });
    }

    // Check for more opponents
    const metadata = state.pendingDecision?.metadata;
    const remainingOpponents = (metadata?.remainingOpponents as Player[]) || [];

    for (const opp of remainingOpponents) {
      const oppState = state.players[opp];
      if (oppState && oppState.hand.length > 3) {
        const discardCount = oppState.hand.length - 3;
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: `Militia: Discard down to 3 cards (discard ${discardCount})`,
            cardOptions: [...oppState.hand],
            min: discardCount,
            max: discardCount,
            cardBeingPlayed: "Militia",
            stage: "opponent_discard",
            metadata: {
              remainingOpponents: remainingOpponents.filter(o => o !== opp),
              attackingPlayer: player,
            },
          },
        };
      }
    }

    return { events };
  }

  return { events: [] };
};
