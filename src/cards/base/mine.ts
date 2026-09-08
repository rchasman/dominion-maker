import { z } from "zod";
import { getGainableTreasures } from "../effect-types";
import { getCardCost } from "../cost";
import { choose, defineEffect, done } from "../program";
import { isTreasureCard } from "../../data/cards";

export const mine = defineEffect(
  z.enum(["trash", "gain"]),
  ({ state, playerId }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Mine");
    if (input.type === "start") {
      const cardOptions =
        state.players[playerId]?.hand.filter(isTreasureCard) ?? [];
      if (!cardOptions.length) return done();
      return choose(
        {
          choiceType: "decision",
          playerId,
          cardBeingPlayed: "Mine",
          intent: "trash",
          from: "hand",
          prompt: "Mine: You may trash a Treasure from your hand",
          cardOptions,
          min: 0,
          max: 1,
        },
        "trash",
      );
    }
    const card = input.answer.selectedCards[0];
    if (!card) return done();
    if (input.memory === "gain")
      return done([{ type: "CARD_GAINED", playerId, card, to: "hand" }]);
    const maxCost = getCardCost(state, card).modifiedCost + 3;
    const cardOptions = getGainableTreasures(state, maxCost);
    const events = [
      { type: "CARD_TRASHED" as const, playerId, card, from: "hand" as const },
    ];
    if (!cardOptions.length) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Mine",
        intent: "gain",
        from: "supply",
        prompt: `Mine: Gain a Treasure costing up to $${maxCost} to your hand`,
        cardOptions,
        min: 1,
        max: 1,
      },
      "gain",
      events,
    );
  },
);
