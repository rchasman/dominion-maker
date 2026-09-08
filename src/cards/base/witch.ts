import { createDrawEvents, getOpponents } from "../effect-types";
import { defineEffect, done, noMemory, schedule } from "../program";

export const witch = defineEffect(
  noMemory,
  ({ state, playerId, trigger, random }) => {
    if (trigger.type === "play") {
      const player = state.players[playerId];
      return schedule(
        [{ type: "attack", targets: getOpponents(state, playerId) }],
        player ? createDrawEvents(playerId, player, 2, random) : [],
      );
    }
    return done(
      trigger.type === "attack" && (state.supply.Curse ?? 0) > 0
        ? [
            {
              type: "CARD_GAINED",
              playerId: trigger.target,
              card: "Curse",
              to: "discard",
            },
          ]
        : [],
    );
  },
);
