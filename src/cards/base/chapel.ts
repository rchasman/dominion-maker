import { cardsToEvents } from "../effect-types";
import { choose, defineEffect, done, noMemory } from "../program";

export const chapel = defineEffect(noMemory, ({ state, playerId }, input) => {
  if (input.type === "continue")
    throw new Error("Unexpected continuation for Chapel");
  if (input.type === "answer")
    return done(
      cardsToEvents(input.answer.selectedCards, playerId, "CARD_TRASHED"),
    );
  const hand = state.players[playerId]?.hand ?? [];
  if (!hand.length) return done();
  return choose(
    {
      choiceType: "decision",
      playerId,
      cardBeingPlayed: "Chapel",
      intent: "trash",
      from: "hand",
      prompt: "Chapel: Trash up to 4 cards from your hand",
      cardOptions: [...hand],
      min: 0,
      max: Math.min(4, hand.length),
    },
    null,
  );
});
