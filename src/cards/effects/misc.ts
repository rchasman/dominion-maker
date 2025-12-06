/**
 * Miscellaneous card effects - unique mechanics that don't fit other categories.
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";

function isActionCard(card: CardName): boolean {
  return CARDS[card].types.includes("action");
}

// +1 Card, +1 Action. Look through discard, may put a card on deck
export const harbinger: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: +1 Card, +1 Action
  if (!decision || stage === undefined) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    // If discard pile is empty, we're done
    if (playerState.discard.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: "Harbinger: Put a card from your discard onto your deck (or skip)",
        cardOptions: [...playerState.discard],
        min: 0,
        max: 1,
        stage: "topdeck",
      },
    };
  }

  // Put card on deck
  if (stage === "topdeck") {
    if (decision.selectedCards.length > 0) {
      const card = decision.selectedCards[0];
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: [card], from: "discard" });
    }
    return { events };
  }

  return { events: [] };
};

// +$2. Discard top card. If it's an Action, you may play it
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
    events.push({ type: "CARDS_DISCARDED", player, cards: [topCard], from: "deck" });

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

// Choose an action from hand, play it twice
export const throneRoom: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: Choose an action to play twice
  if (!decision || stage === undefined) {
    const actions = playerState.hand.filter(isActionCard);

    if (actions.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions: actions,
        min: 0,
        max: 1,
        stage: "choose_action",
      },
    };
  }

  // Play the action twice
  if (stage === "choose_action") {
    if (decision.selectedCards.length === 0) {
      return { events: [] };
    }

    const cardToPlay = decision.selectedCards[0];
    // Note: The engine handles actually playing the card twice
    // We emit a marker event
    events.push({ type: "CARD_PLAYED", player, card: cardToPlay });

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: `Throne Room: Playing ${cardToPlay} (first time)`,
        cardOptions: [],
        min: 0,
        max: 0,
        stage: "execute_first",
        metadata: { throneRoomTarget: cardToPlay },
      },
    };
  }

  return { events: [] };
};

// First Silver you play this turn: +$1
// Note: This is a passive ability tracked by the engine, not an active effect
export const merchant: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = createDrawEvents(player, state.players[player], 1);
  events.push({ type: "ACTIONS_MODIFIED", delta: 1 });
  // The +$1 for Silver is tracked by the engine during buy phase
  return { events };
};

// +1 Card, +1 Action, +$1. Discard 1 card per empty supply pile
export const poacher: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Count empty supply piles
  const emptyPiles = Object.values(state.supply).filter(count => count === 0).length;

  // Initial: +1 Card, +1 Action, +$1
  if (!decision || stage === undefined) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });
    events.push({ type: "COINS_MODIFIED", delta: 1 });

    if (emptyPiles === 0 || playerState.hand.length === 0) {
      return { events };
    }

    const discardCount = Math.min(emptyPiles, playerState.hand.length);

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: `Poacher: Discard ${discardCount} card(s) (${emptyPiles} empty pile(s))`,
        cardOptions: [...playerState.hand],
        min: discardCount,
        max: discardCount,
        stage: "discard",
      },
    };
  }

  // Discard
  if (stage === "discard") {
    if (decision.selectedCards.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: decision.selectedCards, from: "hand" });
    }
    return { events };
  }

  return { events: [] };
};

// Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
export const sentry: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: +1 Card, +1 Action, look at top 2
  if (!decision || stage === undefined) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    const { cards: revealed } = peekDraw(playerState, 2);

    if (revealed.length === 0) {
      return { events };
    }

    events.push({ type: "CARDS_REVEALED", player, cards: revealed, from: "deck" });

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: "Sentry: Select cards to TRASH (others will be discarded or kept)",
        cardOptions: revealed,
        min: 0,
        max: revealed.length,
        stage: "trash",
        metadata: { revealedCards: revealed },
      },
    };
  }

  // Trash selected cards
  if (stage === "trash") {
    const metadata = state.pendingDecision?.metadata;
    const revealed = (metadata?.revealedCards as CardName[]) || [];
    const toTrash = decision.selectedCards;

    if (toTrash.length > 0) {
      events.push({ type: "CARDS_TRASHED", player, cards: toTrash, from: "deck" });
    }

    const remaining = revealed.filter(c => !toTrash.includes(c));

    if (remaining.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: "Sentry: Select cards to DISCARD (rest go back on deck)",
        cardOptions: remaining,
        min: 0,
        max: remaining.length,
        stage: "discard",
        metadata: { remainingCards: remaining },
      },
    };
  }

  // Discard selected, rest go back on deck
  if (stage === "discard") {
    const metadata = state.pendingDecision?.metadata;
    const remaining = (metadata?.remainingCards as CardName[]) || [];
    const toDiscard = decision.selectedCards;

    if (toDiscard.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: toDiscard, from: "deck" });
    }

    const toReturn = remaining.filter(c => !toDiscard.includes(c));

    if (toReturn.length > 1) {
      // Need to choose order
      return {
        events,
        pendingDecision: {
          type: "select_cards",
          player,
          from: "options",
          prompt: "Sentry: Choose order to put cards back (first = top)",
          cardOptions: toReturn,
          min: toReturn.length,
          max: toReturn.length,
          stage: "order",
          metadata: { cardsToReturn: toReturn },
        },
      };
    }

    // Single card or no cards, just put back
    if (toReturn.length === 1) {
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: toReturn, from: "hand" });
    }

    return { events };
  }

  // Order and return to deck
  if (stage === "order") {
    const orderedCards = decision.selectedCards;
    if (orderedCards.length > 0) {
      // Put in reverse order so first selected ends up on top
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: [...orderedCards].reverse(), from: "hand" });
    }
    return { events };
  }

  return { events: [] };
};

// Draw until you have 7 cards in hand, skipping any Actions you choose to
export const library: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Note: Library is complex because it needs to draw one at a time
  // For simplicity, we'll handle it as a single decision

  if (!decision || stage === undefined) {
    const cardsNeeded = 7 - playerState.hand.length;

    if (cardsNeeded <= 0) {
      return { events: [] };
    }

    // Look at what we'd draw
    const { cards: peeked } = peekDraw(playerState, cardsNeeded);
    const actionsInDraw = peeked.filter(isActionCard);

    if (actionsInDraw.length === 0) {
      // No actions, just draw all
      events.push(...createDrawEvents(player, playerState, cardsNeeded));
      return { events };
    }

    // Ask which actions to skip
    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: "Library: Select Actions to set aside (will be discarded)",
        cardOptions: actionsInDraw,
        min: 0,
        max: actionsInDraw.length,
        stage: "skip_actions",
        metadata: { cardsNeeded, peekedCards: peeked },
      },
    };
  }

  if (stage === "skip_actions") {
    const metadata = state.pendingDecision?.metadata;
    const peeked = (metadata?.peekedCards as CardName[]) || [];
    const toSkip = decision.selectedCards;

    // Draw the non-skipped cards
    const toDraw = peeked.filter(c => !toSkip.includes(c));

    if (toDraw.length > 0) {
      events.push({ type: "CARDS_DRAWN", player, cards: toDraw });
    }

    // Discard the skipped actions
    if (toSkip.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: toSkip, from: "deck" });
    }

    return { events };
  }

  return { events: [] };
};

// Gardens: No active effect (VP = floor(deck size / 10))
export const gardens: CardEffect = (): CardEffectResult => {
  return { events: [] };
};
