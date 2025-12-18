/**
 * Sentry - +1 Card, +1 Action. Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import type { CardName } from "../../types/game-state";
import { CARD_ACTIONS } from "../card-actions";
import { getCardNamesFromMetadata } from "../../lib/metadata-helpers";

const SENTRY_PEEK_COUNT = 2;

const SENTRY_ACTIONS = [
  { ...CARD_ACTIONS.topdeck_card, isDefault: true },
  CARD_ACTIONS.trash_card,
  CARD_ACTIONS.discard_card,
];

function createPeekEvents(playerId: PlayerId, cards: CardName[]): GameEvent[] {
  return cards.map(card => ({
    type: "CARD_PEEKED" as const,
    playerId,
    card,
    from: "deck" as const,
  }));
}

type ActionEventParams = {
  playerId: PlayerId;
  revealed: CardName[];
  cardActions: Record<string, string>;
  actionType: string;
  eventType: "CARD_TRASHED" | "CARD_DISCARDED";
};

function createActionEvents(params: ActionEventParams): GameEvent[] {
  const { playerId, revealed, cardActions, actionType, eventType } = params;
  return Object.entries(cardActions)
    .filter(([, action]) => action === actionType)
    .map(([indexStr]) => parseInt(indexStr))
    .filter(index => revealed[index])
    .map(index => ({
      type: eventType,
      playerId,
      card: revealed[index],
      from: "deck" as const,
    }));
}

function createTopdeckEvents(
  playerId: PlayerId,
  revealed: CardName[],
  cardActions: Record<string, string>,
  cardOrder: number[],
): GameEvent[] {
  const topdeckIndices =
    cardOrder.length > 0
      ? cardOrder
      : Object.entries(cardActions)
          .filter(([, action]) => action === "topdeck_card")
          .map(([indexStr]) => parseInt(indexStr));

  return [...topdeckIndices]
    .reverse()
    .filter(index => revealed[index])
    .map(index => ({
      type: "CARD_PUT_ON_DECK" as const,
      playerId,
      card: revealed[index],
      from: "hand" as const,
    }));
}

export const sentry: CardEffect = ({
  state,
  playerId,
  decision,
}): CardEffectResult => {
  const playerState = state.players[playerId]!;

  // Initial: +1 Card, +1 Action, look at top 2
  if (!decision) {
    const drawEvents = createDrawEvents(playerId, playerState, 1);
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
        ...createPeekEvents(playerId, revealed),
      ],
      pendingChoice: {
        choiceType: "decision",
        playerId,
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
  const revealed = getCardNamesFromMetadata(
    state.pendingChoice?.metadata,
    "revealedCards",
  );
  const cardActions = decision.cardActions || {};
  const cardOrder = (decision.cardOrder || []) as number[];

  const events = [
    ...createActionEvents({
      playerId,
      revealed,
      cardActions,
      actionType: "trash_card",
      eventType: "CARD_TRASHED",
    }),
    ...createActionEvents({
      playerId,
      revealed,
      cardActions,
      actionType: "discard_card",
      eventType: "CARD_DISCARDED",
    }),
    ...createTopdeckEvents(playerId, revealed, cardActions, cardOrder),
  ];

  return { events };
};
