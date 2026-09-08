import { createDrawEvents, getOpponents } from "../effect-types";
import { defineEffect, done, noMemory } from "../program";

export const councilRoom = defineEffect(
  noMemory,
  ({ state, playerId, random }) => {
    const player = state.players[playerId];
    if (!player) return done();
    return done([
      ...createDrawEvents(playerId, player, 4, random),
      { type: "BUYS_MODIFIED", delta: 1 },
      ...getOpponents(state, playerId).flatMap(opponent => {
        const target = state.players[opponent];
        return target ? createDrawEvents(opponent, target, 1, random) : [];
      }),
    ]);
  },
);
