import { createDrawEvents } from "../effect-types";
import { defineEffect, done, noMemory } from "../program";

export const merchant = defineEffect(
  noMemory,
  ({ state, playerId, random }) => {
    const player = state.players[playerId];
    return done(
      player
        ? [
            ...createDrawEvents(playerId, player, 1, random),
            { type: "ACTIONS_MODIFIED", delta: 1 },
          ]
        : [],
    );
  },
);
