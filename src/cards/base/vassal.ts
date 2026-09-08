/** Vassal discards the top card and can schedule it as a nested play. */
import { z } from "zod";
import { peekDraw } from "../effect-types";
import { isActionCard } from "../../data/cards";
import type { GameEvent } from "../../events/types";
import {
  cardNameSchema,
  choose,
  defineEffect,
  done,
  schedule,
} from "../program";

export const vassal = defineEffect(
  z.object({ discarded: cardNameSchema }).strict(),
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Vassal");
    if (input.type === "answer") {
      return input.answer.selectedCards.length
        ? schedule([
            {
              type: "play",
              playerId,
              card: input.memory.discarded,
              from: "discard",
            },
          ])
        : done();
    }
    const player = state.players[playerId];
    if (!player) return done();
    const events: GameEvent[] = [{ type: "COINS_MODIFIED", delta: 2 }];
    const { cards, shuffled, newDeckOrder } = peekDraw(player, 1, random);
    const topCard = cards[0];
    if (!topCard) return done(events);
    if (shuffled && newDeckOrder)
      events.push({ type: "DECK_SHUFFLED", playerId, newDeckOrder });
    events.push({
      type: "CARD_DISCARDED",
      playerId,
      card: topCard,
      from: "deck",
    });
    if (!isActionCard(topCard)) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        from: "discard",
        intent: "play",
        prompt: `Vassal: Play ${topCard} from discard?`,
        cardOptions: [topCard],
        min: 0,
        max: 1,
        cardBeingPlayed: "Vassal",
      },
      { discarded: topCard },
      events,
    );
  },
);
