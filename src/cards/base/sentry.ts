/** Sentry draws first, then sets aside the next two cards for inspection. */
import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import { applyEvents } from "../../events/apply";
import type { GameEvent } from "../../events/types";
import { CARD_ACTIONS } from "../card-actions";
import { getCardNamesFromMetadata } from "../../lib/metadata-helpers";

export const sentry: CardEffect = ({
  state,
  playerId,
  random,
  decision,
}): CardEffectResult => {
  const player = state.players[playerId];
  if (!player) return { events: [] };

  if (!decision) {
    const events: GameEvent[] = [
      ...createDrawEvents(playerId, player, 1, random),
      { type: "ACTIONS_MODIFIED", delta: 1 },
    ];
    const afterDraw = applyEvents(state, events);
    const look = createDrawEvents(
      playerId,
      afterDraw.players[playerId]!,
      2,
      random,
    );
    const revealed = look.flatMap(event =>
      event.type === "CARD_DRAWN" ? [event.card] : [],
    );
    events.push(
      ...look.flatMap((event): GameEvent[] =>
        event.type === "CARD_DRAWN"
          ? [
              { type: "CARD_PEEKED", playerId, card: event.card, from: "deck" },
              {
                type: "CARD_SET_ASIDE",
                playerId,
                card: event.card,
                from: "deck",
              },
            ]
          : [event],
      ),
    );
    if (revealed.length === 0) return { events };
    return {
      events,
      pendingChoice: {
        choiceType: "decision",
        playerId,
        prompt: "Sentry: Choose what to do with each card",
        cardOptions: revealed,
        actions: [
          { ...CARD_ACTIONS.topdeck_card, isDefault: true },
          CARD_ACTIONS.trash_card,
          CARD_ACTIONS.discard_card,
        ],
        requiresOrdering: true,
        orderingPrompt:
          "Cards to topdeck will return in this order (first = top)",
        cardBeingPlayed: "Sentry",
        stage: "sort",
        metadata: { revealedCards: revealed },
      },
    };
  }

  const revealed = getCardNamesFromMetadata(
    state.pendingChoice?.metadata,
    "revealedCards",
  );
  const events: GameEvent[] = [];
  const kept: number[] = [];
  revealed.forEach((card, index) => {
    const action = decision.cardActions?.[index] ?? "topdeck_card";
    if (action === "trash_card" || action === "discard_card") {
      events.push({
        type: action === "trash_card" ? "CARD_TRASHED" : "CARD_DISCARDED",
        playerId,
        card,
        from: "setAside",
      });
    } else {
      kept.push(index);
    }
  });
  const requestedOrder = (decision.cardOrder ?? []).filter(
    (index): index is number =>
      typeof index === "number" && kept.includes(index),
  );
  const order = [...new Set([...requestedOrder, ...kept])];
  events.push(
    ...order.reverse().map(
      (index): GameEvent => ({
        type: "CARD_PUT_ON_DECK",
        playerId,
        card: revealed[index]!,
        from: "setAside",
      }),
    ),
  );
  return { events };
};
