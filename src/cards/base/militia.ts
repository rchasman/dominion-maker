/** Militia gives coins, then asks each unblocked target to discard to three. */
import { getOpponents } from "../effect-types";
import { choose, defineEffect, done, noMemory, schedule } from "../program";

export const militia = defineEffect(
  noMemory,
  ({ state, playerId, trigger }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Militia");
    if (trigger.type === "play") {
      return schedule(
        [{ type: "attack", targets: getOpponents(state, playerId) }],
        [{ type: "COINS_MODIFIED", delta: 2 }],
      );
    }
    if (trigger.type !== "attack") return done();
    const target = trigger.target;
    if (input.type === "answer") {
      return done(
        input.answer.selectedCards.map(card => ({
          type: "CARD_DISCARDED",
          playerId: target,
          card,
          from: "hand",
        })),
      );
    }
    const hand = state.players[target]?.hand;
    if (!hand || hand.length <= 3) return done();
    const count = hand.length - 3;
    return choose(
      {
        choiceType: "decision",
        playerId: target,
        from: "hand",
        intent: "discard",
        prompt: `Militia: Discard down to 3 cards (discard ${count})`,
        cardOptions: [...hand],
        min: count,
        max: count,
        cardBeingPlayed: "Militia",
      },
      null,
    );
  },
);
