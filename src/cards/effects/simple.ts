/**
 * Simple card effects - no decisions required.
 * These cards have straightforward effects that don't pause for player input.
 */

import type { CardEffect } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

// +3 Cards
export const smithy: CardEffect = ({ state, player }) => {
  const events = createDrawEvents(player, state.players[player], 3);
  return { events };
};

// +1 Card, +2 Actions
export const village: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 1),
    { type: "ACTIONS_MODIFIED", delta: 2 },
  ];
  return { events };
};

// +2 Cards, +1 Action
export const laboratory: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 2),
    { type: "ACTIONS_MODIFIED", delta: 1 },
  ];
  return { events };
};

// +2 Actions, +1 Buy, +$2
export const festival: CardEffect = () => {
  const events: GameEvent[] = [
    { type: "ACTIONS_MODIFIED", delta: 2 },
    { type: "BUYS_MODIFIED", delta: 1 },
    { type: "COINS_MODIFIED", delta: 2 },
  ];
  return { events };
};

// +1 Card, +1 Action, +1 Buy, +$1
export const market: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = [
    ...createDrawEvents(player, state.players[player], 1),
    { type: "ACTIONS_MODIFIED", delta: 1 },
    { type: "BUYS_MODIFIED", delta: 1 },
    { type: "COINS_MODIFIED", delta: 1 },
  ];
  return { events };
};

// +4 Cards, +1 Buy, each other player draws a card
export const councilRoom: CardEffect = ({ state, player }) => {
  const events: GameEvent[] = createDrawEvents(player, state.players[player], 4);
  events.push({ type: "BUYS_MODIFIED", delta: 1 });

  // Each opponent draws a card
  const playerOrder = state.playerOrder || ["human", "ai"];
  for (const opponent of playerOrder) {
    if (opponent !== player && state.players[opponent]) {
      events.push(...createDrawEvents(opponent, state.players[opponent], 1));
    }
  }

  return { events };
};

// +$2
export const woodcutter: CardEffect = () => {
  // Note: Woodcutter is not in 2nd edition, but including for completeness
  const events: GameEvent[] = [
    { type: "BUYS_MODIFIED", delta: 1 },
    { type: "COINS_MODIFIED", delta: 2 },
  ];
  return { events };
};

// +2 Cards (Reaction: reveal to be unaffected by attack)
export const moat: CardEffect = ({ state, player }) => {
  const events = createDrawEvents(player, state.players[player], 2);
  return { events };
};
