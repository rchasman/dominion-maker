import { isActionCard } from "../../data/cards";
import { choose, defineEffect, done, noMemory, schedule } from "../program";

export const throneRoom = defineEffect(
  noMemory,
  ({ state, playerId }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Throne Room");
    if (input.type === "answer") {
      const card = input.answer.selectedCards[0];
      return card
        ? schedule([{ type: "play", playerId, card, from: "hand", times: 2 }])
        : done();
    }
    const cardOptions =
      state.players[playerId]?.hand.filter(isActionCard) ?? [];
    if (!cardOptions.length) return done();
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Throne Room",
        intent: "play",
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions,
        min: 0,
        max: 1,
      },
      null,
    );
  },
);
