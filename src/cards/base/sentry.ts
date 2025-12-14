/**
 * Sentry - +1 Card, +1 Action. Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import type { CardName } from "../../types/game-state";

const SENTRY_PEEK_COUNT = 2;

const SENTRY_ACTIONS = [
  { id: "topdeck", label: "Topdeck", color: "#10B981", isDefault: true },
  { id: "trash", label: "Trash", color: "#EF4444" },
  { id: "discard", label: "Discard", color: "#9CA3AF" },
] as const;

function createPeekEvents(player: PlayerId, cards: CardName[]): GameEvent[] {
  return cards.map(card => ({
    type: "CARD_PEEKED" as const,
    player,
    card,
    from: "deck" as const,
  }));
}

type ActionEventParams = {
  player: PlayerId;
  revealed: CardName[];
  cardActions: Record<string, string>;
  actionType: string;
  eventType: "CARD_TRASHED" | "CARD_DISCARDED";
};

function createActionEvents(params: ActionEventParams): GameEvent[] {
  const { player, revealed, cardActions, actionType, eventType } = params;
  return Object.entries(cardActions)
    .filter(([, action]) => action === actionType)
    .map(([indexStr]) => parseInt(indexStr))
    .filter(index => revealed[index])
    .map(index => ({
      type: eventType,
      player,
      card: revealed[index],
      from: "deck" as const,
    }));
}

function createTopdeckEvents(
  player: PlayerId,
  revealed: CardName[],
  cardActions: Record<string, string>,
  cardOrder: number[],
): GameEvent[] {
  const topdeckIndices =
    cardOrder.length > 0
      ? cardOrder
      : Object.entries(cardActions)
          .filter(([, action]) => action === "topdeck")
          .map(([indexStr]) => parseInt(indexStr));

  return [...topdeckIndices]
    .reverse()
    .filter(index => revealed[index])
    .map(index => ({
      type: "CARD_PUT_ON_DECK" as const,
      player,
      card: revealed[index],
      from: "hand" as const,
    }));
}

export const sentry: CardEffect = ({
  state,
  player,
  decision,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Initial: +1 Card, +1 Action, look at top 2
  if (!decision) {
    const drawEvents = createDrawEvents(player, playerState, 1);
    const { cards: revealed } = peekDraw(playerState, SENTRY_PEEK_COUNT);

    if (revealed.length === 0) {
      return {
        events: [...drawEvents, { type: "ACTIONS_MODIFIED", delta: 1 }],
      };
    }

    return {
      events: [
        ...drawEvents,
        { type: "ACTIONS_MODIFIED", delta: 1 },
        ...createPeekEvents(player, revealed),
      ],
      pendingDecision: {
        type: "card_decision",
        player,
        prompt: "Sentry: Choose what to do with each card",
        cardOptions: revealed,
        actions: [...SENTRY_ACTIONS],
        requiresOrdering: true,
        orderingPrompt:
          "Cards to topdeck will return in this order (first = top)",
        cardBeingPlayed: "Sentry",
        metadata: { revealedCards: revealed },
      },
    };
  }

  // Process the decision
  const revealed =
    (state.pendingDecision?.metadata?.revealedCards as CardName[]) || [];
  const cardActions = decision.cardActions || {};
  const cardOrder = (decision.cardOrder || []) as number[];

  const events = [
    ...createActionEvents({
      player,
      revealed,
      cardActions,
      actionType: "trash",
      eventType: "CARD_TRASHED",
    }),
    ...createActionEvents({
      player,
      revealed,
      cardActions,
      actionType: "discard",
      eventType: "CARD_DISCARDED",
    }),
    ...createTopdeckEvents(player, revealed, cardActions, cardOrder),
  ];

  return { events };
};
