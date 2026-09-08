import { z } from "zod";
import type { CardName, PlayerId } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import { getGainableCards } from "../effect-types";
import { choose, defineEffect, done } from "../program";

function topdeck(
  playerId: PlayerId,
  hand: CardName[],
  events: GameEvent[] = [],
) {
  if (!hand.length) return done(events);
  return choose(
    {
      choiceType: "decision",
      playerId,
      cardBeingPlayed: "Artisan",
      intent: "topdeck",
      from: "hand",
      prompt: "Artisan: Put a card from your hand onto your deck",
      cardOptions: hand,
      min: 1,
      max: 1,
    },
    "topdeck" as const,
    events,
  );
}

export const artisan = defineEffect(
  z.enum(["gain", "topdeck"]),
  ({ state, playerId }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Artisan");
    const hand = state.players[playerId]?.hand ?? [];
    if (input.type === "start") {
      const cardOptions = getGainableCards(state, 5);
      if (!cardOptions.length) return topdeck(playerId, [...hand]);
      return choose(
        {
          choiceType: "decision",
          playerId,
          cardBeingPlayed: "Artisan",
          intent: "gain",
          from: "supply",
          prompt: "Artisan: Gain a card costing up to $5 to your hand",
          cardOptions,
          min: 1,
          max: 1,
        },
        "gain",
      );
    }
    const card = input.answer.selectedCards[0];
    if (input.memory === "topdeck")
      return done(
        card
          ? [{ type: "CARD_PUT_ON_DECK", playerId, card, from: "hand" }]
          : [],
      );
    return topdeck(
      playerId,
      card ? [...hand, card] : [...hand],
      card ? [{ type: "CARD_GAINED", playerId, card, to: "hand" }] : [],
    );
  },
);
