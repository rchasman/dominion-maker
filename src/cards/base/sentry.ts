/** Sentry draws first, then sets aside the next two cards for inspection. */
import { z } from "zod";
import { cardNameSchema, choose, defineEffect, done } from "../program";
import { createDrawEvents, projectEffectEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARD_ACTIONS } from "../card-actions";

export const sentry = defineEffect(
  z.object({ revealed: z.array(cardNameSchema).min(1).max(2) }).strict(),
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Sentry");
    const player = state.players[playerId];
    if (!player) return done();

    if (input.type === "start") {
      const events: GameEvent[] = [
        ...createDrawEvents(playerId, player, 1, random),
        { type: "ACTIONS_MODIFIED", delta: 1 },
      ];
      const afterDraw = projectEffectEvents(state, events);
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
                {
                  type: "CARD_PEEKED",
                  playerId,
                  card: event.card,
                  from: "deck",
                },
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
      if (revealed.length === 0) return done(events);
      return choose(
        {
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
          intent: "organize",
        },
        { revealed },
        events,
      );
    }

    const { revealed } = input.memory;
    const decision = input.answer;
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
    return done(events);
  },
);
