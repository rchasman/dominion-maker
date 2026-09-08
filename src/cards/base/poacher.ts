import {
  cardsToEvents,
  createDrawEvents,
  projectEffectEvents,
} from "../effect-types";
import { choose, defineEffect, done, noMemory } from "../program";

export const poacher = defineEffect(
  noMemory,
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Poacher");
    if (input.type === "answer")
      return done(
        cardsToEvents(input.answer.selectedCards, playerId, "CARD_DISCARDED"),
      );
    const player = state.players[playerId];
    if (!player) return done();
    const events = [
      ...createDrawEvents(playerId, player, 1, random),
      { type: "ACTIONS_MODIFIED" as const, delta: 1 },
      { type: "COINS_MODIFIED" as const, delta: 1 },
    ];
    const hand =
      projectEffectEvents(state, events).players[playerId]?.hand ?? [];
    const emptyPiles = Object.values(state.supply).filter(
      count => count === 0,
    ).length;
    const count = Math.min(emptyPiles, hand.length);
    if (!count) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Poacher",
        intent: "discard",
        from: "hand",
        prompt: `Poacher: Discard ${count} card(s) (${emptyPiles} empty pile(s))`,
        cardOptions: [...hand],
        min: count,
        max: count,
      },
      null,
      events,
    );
  },
);
