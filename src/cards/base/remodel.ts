import { z } from "zod";
import { getGainableCards } from "../effect-types";
import { getCardCost } from "../cost";
import { choose, defineEffect, done } from "../program";

export const remodel = defineEffect(
  z.enum(["trash", "gain"]),
  ({ state, playerId }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Remodel");
    if (input.type === "start") {
      const cardOptions = state.players[playerId]?.hand.slice() ?? [];
      if (!cardOptions.length) return done();
      return choose(
        {
          choiceType: "decision",
          playerId,
          cardBeingPlayed: "Remodel",
          intent: "trash",
          from: "hand",
          prompt: "Remodel: Choose a card to trash",
          cardOptions,
          min: 1,
          max: 1,
        },
        "trash",
      );
    }
    const card = input.answer.selectedCards[0];
    if (!card) return done();
    if (input.memory === "gain")
      return done([{ type: "CARD_GAINED", playerId, card, to: "discard" }]);
    const maxCost = getCardCost(state, card).modifiedCost + 2;
    const cardOptions = getGainableCards(state, maxCost);
    const events = [
      { type: "CARD_TRASHED" as const, playerId, card, from: "hand" as const },
    ];
    if (!cardOptions.length) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Remodel",
        intent: "gain",
        from: "supply",
        prompt: `Remodel: Gain a card costing up to $${maxCost}`,
        cardOptions,
        min: 1,
        max: 1,
      },
      "gain",
      events,
    );
  },
);
