import {
  cardsToEvents,
  createDrawEvents,
  projectEffectEvents,
} from "../effect-types";
import { choose, defineEffect, done, noMemory } from "../program";

export const cellar = defineEffect(
  noMemory,
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Cellar");
    const player = state.players[playerId];
    if (!player) return done();
    if (input.type === "answer") {
      const selected = input.answer.selectedCards;
      const events = cardsToEvents(selected, playerId, "CARD_DISCARDED");
      const afterDiscard = projectEffectEvents(state, events).players[playerId];
      return done([
        ...events,
        ...createDrawEvents(playerId, afterDiscard!, selected.length, random),
      ]);
    }
    const events = [{ type: "ACTIONS_MODIFIED" as const, delta: 1 }];
    if (!player.hand.length) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Cellar",
        intent: "discard",
        from: "hand",
        prompt: "Cellar: Discard any number of cards, then draw that many",
        cardOptions: [...player.hand],
        min: 0,
        max: player.hand.length,
      },
      null,
      events,
    );
  },
);
