/** Library draws sequentially, keeping skipped Actions out of reshuffles. */
import { z } from "zod";
import type { GameEvent } from "../../events/types";
import { createDrawEvents, projectEffectEvents } from "../effect-types";
import { isActionCard } from "../../data/cards";
import { CARD_ACTIONS } from "../card-actions";
import { cardNameSchema, choose, defineEffect, done } from "../program";

const memory = z
  .object({
    offered: cardNameSchema,
    skipped: z.array(cardNameSchema),
  })
  .strict();

export const library = defineEffect(
  memory,
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Library");
    if (!state.players[playerId]) return done();
    const events: GameEvent[] = [];
    const skipped = input.type === "answer" ? [...input.memory.skipped] : [];
    let current = state;
    const emit = (next: GameEvent[]) => {
      events.push(...next);
      current = projectEffectEvents(current, next);
    };

    if (input.type === "answer") {
      const card = input.memory.offered;
      if (input.answer.cardActions?.[0] === "discard_card") {
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
        return choose(
          {
            choiceType: "decision",
            playerId,
            intent: "keep",
            prompt: "Library: Keep this Action or set it aside?",
            cardOptions: [drawn.card],
            actions: [
              { ...CARD_ACTIONS.draw_card, isDefault: true },
              { ...CARD_ACTIONS.discard_card, label: "Set aside" },
            ],
            cardBeingPlayed: "Library",
          },
          { offered: drawn.card, skipped },
          events,
        );
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
    return done(events);
  },
);
