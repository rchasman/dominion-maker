/**
 * Bandit - Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents, peekDraw } from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { CardName, PlayerState } from "../../types/game-state";

const BANDIT_REVEAL_COUNT = 2;

function createRevealEvents(opp: PlayerId, cards: CardName[]): GameEvent[] {
  return cards.map(card => ({
    type: "CARD_REVEALED" as const,
    player: opp,
    card,
    from: "deck" as const,
  }));
}

function createDiscardEvents(opp: PlayerId, cards: CardName[]): GameEvent[] {
  return cards.map(card => ({
    type: "CARD_DISCARDED" as const,
    player: opp,
    card,
    from: "deck" as const,
  }));
}

function processOpponentAttack(
  opp: PlayerId,
  oppState: PlayerState,
): GameEvent[] {
  const { cards: revealed } = peekDraw(oppState, BANDIT_REVEAL_COUNT);
  if (revealed.length === 0) return [];

  const revealEvents = createRevealEvents(opp, revealed);
  const trashable = revealed.filter(
    c => CARDS[c].types.includes("treasure") && c !== "Copper",
  );

  if (trashable.length === 0) {
    return [...revealEvents, ...createDiscardEvents(opp, revealed)];
  }

  // Trash the best one (prefer Gold > Silver)
  const toTrash = trashable.includes("Gold") ? "Gold" : trashable[0];
  const trashEvent: GameEvent = {
    type: "CARD_TRASHED",
    player: opp,
    card: toTrash,
    from: "deck",
  };
  const remaining = revealed.filter(c => c !== toTrash);

  return [...revealEvents, trashEvent, ...createDiscardEvents(opp, remaining)];
}

export const bandit: CardEffect = ({ state, player }): CardEffectResult => {
  const opponents = getOpponents(state, player);

  // Gain Gold
  const gainEvents: GameEvent[] =
    state.supply.Gold > 0
      ? [{ type: "CARD_GAINED", player, card: "Gold", to: "discard" }]
      : [];

  // Attack each opponent
  const attackEvents = opponents.flatMap(opp => {
    const oppState = state.players[opp];
    return oppState ? processOpponentAttack(opp, oppState) : [];
  });

  return { events: [...gainEvents, ...attackEvents] };
};
