/**
 * Militia - +$2. Each other player discards down to 3 cards in hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents } from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import type { GameState } from "../../types/game-state";

const MILITIA_HAND_LIMIT = 3;
const MILITIA_COIN_BONUS = 2;

type MilitiaDecision = {
  player: PlayerId;
  hand: string[];
  discardCount: number;
  remainingOpponents: PlayerId[];
  attackingPlayer: PlayerId;
};

function findOpponentNeedingDiscard(
  state: GameState,
  opponents: PlayerId[],
  attackingPlayer: PlayerId,
): MilitiaDecision | null {
  const found = opponents.find(opp => {
    const oppState = state.players[opp];
    return oppState && oppState.hand.length > MILITIA_HAND_LIMIT;
  });

  if (!found) return null;

  const oppState = state.players[found];
  return {
    player: found,
    hand: oppState.hand,
    discardCount: oppState.hand.length - MILITIA_HAND_LIMIT,
    remainingOpponents: opponents.filter(o => o !== found),
    attackingPlayer,
  };
}

function createDiscardDecision(
  d: MilitiaDecision,
): CardEffectResult["pendingDecision"] {
  return {
    type: "card_decision",
    player: d.player,
    from: "hand",
    prompt: `Militia: Discard down to 3 cards (discard ${d.discardCount})`,
    cardOptions: [...d.hand],
    min: d.discardCount,
    max: d.discardCount,
    cardBeingPlayed: "Militia",
    stage: "opponent_discard",
    metadata: {
      remainingOpponents: d.remainingOpponents,
      attackingPlayer: d.attackingPlayer,
    },
  };
}

function createDiscardEvents(cards: string[], player: PlayerId): GameEvent[] {
  return cards.map(card => ({
    type: "CARD_DISCARDED" as const,
    player,
    card,
    from: "hand" as const,
  }));
}

export const militia: CardEffect = ({
  state,
  player,
  attackTargets,
  decision,
  stage,
}): CardEffectResult => {
  const events: GameEvent[] = [
    { type: "COINS_MODIFIED", delta: MILITIA_COIN_BONUS },
  ];

  // Engine auto-handles reactions, provides resolved targets
  if (!stage && attackTargets) {
    const needsDiscard = findOpponentNeedingDiscard(
      state,
      attackTargets,
      player,
    );
    if (needsDiscard) {
      return { events, pendingDecision: createDiscardDecision(needsDiscard) };
    }
    return { events };
  }

  // Process opponent discard
  if (stage === "opponent_discard" && decision) {
    const toDiscard = decision.selectedCards || [];
    const discardingPlayer = state.pendingDecision?.player;
    const events = discardingPlayer
      ? createDiscardEvents(toDiscard, discardingPlayer)
      : [];

    const metadata = state.pendingDecision?.metadata;
    const remainingOpponents = (metadata?.remainingOpponents as string[]) || [];
    const attackingPlayer = (metadata?.attackingPlayer as string) || player;

    const needsDiscard = findOpponentNeedingDiscard(
      state,
      remainingOpponents,
      attackingPlayer,
    );
    if (needsDiscard) {
      return { events, pendingDecision: createDiscardDecision(needsDiscard) };
    }
    return { events };
  }

  return { events: [] };
};
