import { getGainableCards } from "../effect-types";
import { choose, defineEffect, done, noMemory } from "../program";

export const workshop = defineEffect(noMemory, ({ state, playerId }, input) => {
  if (input.type === "continue")
    throw new Error("Unexpected continuation for Workshop");
  if (input.type === "answer") {
    const card = input.answer.selectedCards[0];
    return done(
      card ? [{ type: "CARD_GAINED", playerId, card, to: "discard" }] : [],
    );
  }
  const cardOptions = getGainableCards(state, 4);
  if (!cardOptions.length) return done();
  return choose(
    {
      choiceType: "decision",
      playerId,
      cardBeingPlayed: "Workshop",
      intent: "gain",
      from: "supply",
      prompt: "Workshop: Gain a card costing up to $4",
      cardOptions,
      min: 1,
      max: 1,
    },
    null,
  );
});
