/** Bureaucrat gains a Silver and resolves each target's Victory-card topdeck. */
import { CARDS } from "../../data/cards";
import { getOpponents } from "../effect-types";
import { choose, defineEffect, done, noMemory, schedule } from "../program";

export const bureaucrat = defineEffect(
  noMemory,
  ({ state, playerId, trigger }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Bureaucrat");
    if (trigger.type === "play") {
      return schedule(
        [{ type: "attack", targets: getOpponents(state, playerId) }],
        (state.supply.Silver ?? 0) > 0
          ? [{ type: "CARD_GAINED", playerId, card: "Silver", to: "deck" }]
          : [],
      );
    }
    if (trigger.type !== "attack") return done();
    const target = trigger.target;
    if (input.type === "answer") {
      const card = input.answer.selectedCards[0];
      return done(
        card
          ? [{ type: "CARD_PUT_ON_DECK", playerId: target, card, from: "hand" }]
          : [],
      );
    }
    const hand = state.players[target]?.hand ?? [];
    const victoryCards = hand.filter(card =>
      CARDS[card].types.includes("victory"),
    );
    if (!victoryCards.length) {
      return done(
        hand.map(card => ({
          type: "CARD_REVEALED",
          playerId: target,
          card,
          from: "hand",
        })),
      );
    }
    return choose(
      {
        choiceType: "decision",
        playerId: target,
        from: "hand",
        intent: "topdeck",
        prompt: "Bureaucrat: Put a Victory card on your deck",
        cardOptions: victoryCards,
        min: 1,
        max: 1,
        cardBeingPlayed: "Bureaucrat",
      },
      null,
    );
  },
);
