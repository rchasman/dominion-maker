/** Library draws sequentially, keeping skipped Actions out of reshuffles. */
import type { CardEffect, CardEffectResult } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { createDrawEvents } from "../effect-types";
import { applyEvents } from "../../events/apply";
import { isActionCard } from "../../data/cards";
import { CARD_ACTIONS } from "../card-actions";
import { getCardNamesFromMetadata } from "../../lib/metadata-helpers";

export const library: CardEffect = ({
  state,
  playerId,
  random,
  decision,
}): CardEffectResult => {
  if (!state.players[playerId]) return { events: [] };
  const events: GameEvent[] = [];
  const skipped = decision
    ? [
        ...getCardNamesFromMetadata(
          state.pendingChoice?.metadata,
          "skippedCards",
        ),
      ]
    : [];
  let current = state;
  const emit = (next: GameEvent[]) => {
    events.push(...next);
    current = applyEvents(current, next);
  };

  if (decision) {
    const card =
      state.pendingChoice?.choiceType === "decision"
        ? state.pendingChoice.cardOptions[0]
        : undefined;
    if (!card) return { events: [] };
    if (decision.cardActions?.[0] === "discard_card") {
      skipped.push(card);
    } else {
      emit([
        { type: "CARD_RETURNED_TO_HAND", playerId, card, from: "setAside" },
      ]);
    }
  }

  while (current.players[playerId]!.hand.length < 7) {
    const draw = createDrawEvents(
      playerId,
      current.players[playerId]!,
      1,
      random,
    );
    const drawn = draw.find(event => event.type === "CARD_DRAWN");
    if (!drawn || drawn.type !== "CARD_DRAWN") break;
    if (isActionCard(drawn.card)) {
      emit(
        draw.map(event =>
          event.type === "CARD_DRAWN"
            ? {
                type: "CARD_SET_ASIDE",
                playerId,
                card: event.card,
                from: "deck",
              }
            : event,
        ),
      );
      return {
        events,
        pendingChoice: {
          choiceType: "decision",
          playerId,
          prompt: "Library: Keep this Action or set it aside?",
          cardOptions: [drawn.card],
          actions: [
            { ...CARD_ACTIONS.draw_card, isDefault: true },
            { ...CARD_ACTIONS.discard_card, label: "Set aside" },
          ],
          cardBeingPlayed: "Library",
          stage: "keep-or-skip",
          metadata: { skippedCards: skipped },
        },
      };
    }
    emit(draw);
  }

  emit(
    skipped.map(card => ({
      type: "CARD_DISCARDED",
      playerId,
      card,
      from: "setAside",
    })),
  );
  return { events };
};
