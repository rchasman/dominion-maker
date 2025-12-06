/**
 * Attack and multi-stage card effects.
 * These cards affect opponents or have complex iterative interactions.
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, getOpponents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName, Player } from "../../types/game-state";
import { CARDS } from "../../data/cards";

// +1 Action. Discard any number of cards, then draw that many
export const cellar: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial call: +1 Action, then request discards
  if (!decision || stage === undefined) {
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    if (playerState.hand.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Cellar: Discard any number of cards to draw that many",
        cardOptions: [...playerState.hand],
        min: 0,
        max: playerState.hand.length,
        stage: "discard",
      },
    };
  }

  // Process discards and draw
  if (stage === "discard") {
    const toDiscard = decision.selectedCards;

    if (toDiscard.length === 0) {
      return { events: [] };
    }

    // Discard selected cards
    events.push({
      type: "CARDS_DISCARDED",
      player,
      cards: toDiscard,
      from: "hand",
    });

    // Draw equal number
    // Need to compute draw from state AFTER discards
    const handAfterDiscard = playerState.hand.filter(c => !toDiscard.includes(c));
    const discardAfterDiscard = [...playerState.discard, ...toDiscard];
    const deckForDraw = [...playerState.deck];

    // Simulate the deck state after discarding
    const simulatedState = {
      ...playerState,
      hand: handAfterDiscard,
      discard: discardAfterDiscard,
      deck: deckForDraw,
    };

    const drawEvents = createDrawEvents(player, simulatedState, toDiscard.length);
    events.push(...drawEvents);

    return { events };
  }

  return { events: [] };
};

// +$2. Each other player discards down to 3 cards in hand
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
  if (stage === "opponent_discard") {
    const toDiscard = decision.selectedCards;
    const discardingPlayer = state.pendingDecision?.player as Player;

    if (toDiscard.length > 0) {
      events.push({
        type: "CARDS_DISCARDED",
        player: discardingPlayer,
        cards: toDiscard,
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

// +2 Cards. Each other player gains a Curse
export const witch: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = createDrawEvents(player, state.players[player], 2);
  const opponents = getOpponents(state, player);

  // Each opponent gains a Curse if available
  for (const opp of opponents) {
    if (state.supply.Curse > 0) {
      events.push({ type: "CARD_GAINED", player: opp, card: "Curse", to: "discard" });
    }
  }

  return { events };
};

// Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
export const bandit: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = [];
  const opponents = getOpponents(state, player);

  // Gain Gold
  if (state.supply.Gold > 0) {
    events.push({ type: "CARD_GAINED", player, card: "Gold", to: "discard" });
  }

  // Attack each opponent
  for (const opp of opponents) {
    const oppState = state.players[opp];
    if (!oppState) continue;

    // Reveal top 2 cards
    const { cards: revealed } = peekDraw(oppState, 2);

    if (revealed.length > 0) {
      events.push({ type: "CARDS_REVEALED", player: opp, cards: revealed, from: "deck" });

      // Find non-Copper treasures to trash (Silver or Gold)
      const trashable = revealed.filter(
        c => CARDS[c].types.includes("treasure") && c !== "Copper"
      );

      if (trashable.length > 0) {
        // Trash the first one (prefer Gold > Silver if multiple)
        const toTrash = trashable.includes("Gold") ? "Gold" : trashable[0];
        events.push({ type: "CARDS_TRASHED", player: opp, cards: [toTrash], from: "deck" });

        // Remaining revealed cards go to discard
        const remaining = revealed.filter(c => c !== toTrash);
        if (remaining.length > 0) {
          events.push({ type: "CARDS_DISCARDED", player: opp, cards: remaining, from: "deck" });
        }
      } else {
        // No treasures to trash, all revealed go to discard
        events.push({ type: "CARDS_DISCARDED", player: opp, cards: revealed, from: "deck" });
      }
    }
  }

  return { events };
};

// +$2. Each other player puts a card from hand onto their deck
export const bureaucrat: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const events: GameEvent[] = [];
  const opponents = getOpponents(state, player);

  // Initial: Gain Silver to deck, then opponents react
  if (!decision || stage === undefined) {
    if (state.supply.Silver > 0) {
      events.push({ type: "CARD_GAINED", player, card: "Silver", to: "deck" });
    }

    // Find first opponent with a Victory card
    for (const opp of opponents) {
      const oppState = state.players[opp];
      if (!oppState) continue;

      const victoryCards = oppState.hand.filter(c => CARDS[c].types.includes("victory"));

      if (victoryCards.length > 0) {
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: "Bureaucrat: Put a Victory card on your deck",
            cardOptions: victoryCards,
            min: 1,
            max: 1,
            stage: "opponent_topdeck",
            metadata: { remainingOpponents: opponents.filter(o => o !== opp) },
          },
        };
      }
      // If no victory cards, reveal hand (handled in UI)
    }

    return { events };
  }

  // Process opponent's card to deck
  if (stage === "opponent_topdeck") {
    const toPutOnDeck = decision.selectedCards[0];
    const affectedPlayer = state.pendingDecision?.player as Player;

    if (toPutOnDeck) {
      events.push({ type: "CARDS_PUT_ON_DECK", player: affectedPlayer, cards: [toPutOnDeck], from: "hand" });
    }

    // Check for more opponents
    const metadata = state.pendingDecision?.metadata;
    const remainingOpponents = (metadata?.remainingOpponents as Player[]) || [];

    for (const opp of remainingOpponents) {
      const oppState = state.players[opp];
      if (!oppState) continue;

      const victoryCards = oppState.hand.filter(c => CARDS[c].types.includes("victory"));

      if (victoryCards.length > 0) {
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: "Bureaucrat: Put a Victory card on your deck",
            cardOptions: victoryCards,
            min: 1,
            max: 1,
            stage: "opponent_topdeck",
            metadata: { remainingOpponents: remainingOpponents.filter(o => o !== opp) },
          },
        };
      }
    }

    return { events };
  }

  return { events: [] };
};
