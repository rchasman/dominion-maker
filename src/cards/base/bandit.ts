import { z } from "zod";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName, PlayerId } from "../../types/game-state";
import { CARDS } from "../../data/cards";
import {
  cardNameSchema,
  choose,
  defineEffect,
  done,
  schedule,
} from "../program";

function finish(
  target: PlayerId,
  revealed: CardName[],
  trashed?: CardName,
): GameEvent[] {
  const remaining = [...revealed];
  const events: GameEvent[] = [];
  if (trashed) {
    remaining.splice(remaining.indexOf(trashed), 1);
    events.push({
      type: "CARD_TRASHED",
      playerId: target,
      card: trashed,
      from: "setAside",
    });
  }
  return [
    ...events,
    ...remaining.map(
      (card): GameEvent => ({
        type: "CARD_DISCARDED",
        playerId: target,
        card,
        from: "setAside",
      }),
    ),
  ];
}

export const bandit = defineEffect(
  z.object({ revealed: z.array(cardNameSchema).length(2) }).strict(),
  ({ state, playerId, trigger, random }, input) => {
    if (input.type === "continue")
      throw new Error("Unexpected continuation for Bandit");
    if (trigger.type === "play") {
      return schedule(
        [{ type: "attack", targets: getOpponents(state, playerId) }],
        (state.supply.Gold ?? 0) > 0
          ? [{ type: "CARD_GAINED", playerId, card: "Gold", to: "discard" }]
          : [],
      );
    }
    if (trigger.type !== "attack") return done();
    const target = trigger.target;
    if (input.type === "answer") {
      return done(
        finish(target, input.memory.revealed, input.answer.selectedCards[0]),
      );
    }
    const player = state.players[target];
    if (!player) return done();
    const draw = createDrawEvents(target, player, 2, random);
    const revealed = draw.flatMap(event =>
      event.type === "CARD_DRAWN" ? [event.card] : [],
    );
    const events = draw.flatMap((event): GameEvent[] =>
      event.type === "CARD_DRAWN"
        ? [
            {
              type: "CARD_REVEALED",
              playerId: target,
              card: event.card,
              from: "deck",
            },
            {
              type: "CARD_SET_ASIDE",
              playerId: target,
              card: event.card,
              from: "deck",
            },
          ]
        : [event],
    );
    const trashable = revealed.filter(
      card => card !== "Copper" && CARDS[card].types.includes("treasure"),
    );
    if (new Set(trashable).size > 1) {
      return choose(
        {
          choiceType: "decision",
          playerId: target,
          from: "revealed",
          intent: "trash",
          prompt: "Bandit: Choose a Treasure to trash",
          cardOptions: trashable,
          min: 1,
          max: 1,
          cardBeingPlayed: "Bandit",
        },
        { revealed },
        events,
      );
    }
    return done([...events, ...finish(target, revealed, trashable[0])]);
  },
);
