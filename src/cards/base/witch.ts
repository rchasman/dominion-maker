import { createAttackEffect } from "../attack-effect";
import { createDrawEvents, getOpponents } from "../effect-types";

export const witch = createAttackEffect(
  ({ state, playerId, random }) => ({
    events: state.players[playerId]
      ? createDrawEvents(playerId, state.players[playerId]!, 2, random)
      : [],
  }),
  ({ state, playerId, attackTargets }) => ({
    events: (attackTargets ?? getOpponents(state, playerId))
      .slice(0, state.supply.Curse ?? 0)
      .map(target => ({
        type: "CARD_GAINED",
        playerId: target,
        card: "Curse",
        to: "discard",
      })),
  }),
);
