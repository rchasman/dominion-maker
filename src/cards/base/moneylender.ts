import { choose, defineEffect, done, noMemory } from "../program";

export const moneylender = defineEffect(
  noMemory,
  ({ state, playerId }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Moneylender");
    if (input.type === "answer")
      return input.answer.selectedCards.includes("Copper")
        ? done([
            { type: "CARD_TRASHED", playerId, card: "Copper", from: "hand" },
            { type: "COINS_MODIFIED", delta: 3 },
          ])
        : done();
    if (!state.players[playerId]?.hand.includes("Copper")) return done();
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Moneylender",
        intent: "trash",
        from: "hand",
        prompt: "Moneylender: Trash a Copper for +$3?",
        cardOptions: ["Copper"],
        min: 0,
        max: 1,
      },
      null,
    );
  },
);
