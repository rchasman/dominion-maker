import { createDrawEvents, projectEffectEvents } from "../effect-types";
import { choose, defineEffect, done, noMemory } from "../program";

export const harbinger = defineEffect(
  noMemory,
  ({ state, playerId, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Harbinger");
    if (input.type === "answer") {
      const card = input.answer.selectedCards[0];
      return done(
        card
          ? [{ type: "CARD_PUT_ON_DECK", playerId, card, from: "discard" }]
          : [],
      );
    }
    const player = state.players[playerId];
    if (!player) return done();
    const events = [
      ...createDrawEvents(playerId, player, 1, random),
      { type: "ACTIONS_MODIFIED" as const, delta: 1 },
    ];
    const discard =
      projectEffectEvents(state, events).players[playerId]?.discard ?? [];
    if (!discard.length) return done(events);
    return choose(
      {
        choiceType: "decision",
        playerId,
        cardBeingPlayed: "Harbinger",
        intent: "topdeck",
        from: "discard",
        prompt:
          "Harbinger: Put a card from your discard onto your deck (or skip)",
        cardOptions: [...discard],
        min: 0,
        max: 1,
      },
      null,
      events,
    );
  },
);
