/**
 * Bandit - Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
 */

import {
  createOpponentIteratorEffect,
  peekDraw,
  getOpponents,
} from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import type { GameState } from "../../types/game-state";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";
import { STAGES } from "../stages";

const BANDIT_REVEAL_COUNT = 2;

type BanditAttackData = {
  opponent: string;
  revealed: CardName[];
  trashable: CardName[];
};

/**
 * Process opponent's reveal without decision (0 or 1 trashable)
 */
function processOpponentAutoAttack(
  state: GameState,
  target: PlayerId,
): GameEvent[] {
  const targetState = state.players[target];
  if (!targetState) return [];

  const { cards: revealed } = peekDraw(targetState, BANDIT_REVEAL_COUNT);
  if (revealed.length === 0) return [];

  const revealEvents: GameEvent[] = revealed.map(card => ({
    type: "CARD_REVEALED" as const,
    playerId: target,
    card,
    from: "deck" as const,
  }));

  const trashable = revealed.filter(
    c => CARDS[c].types.includes("treasure") && c !== "Copper",
  );

  if (trashable.length === 0) {
    const discardEvents = revealed.map(card => ({
      type: "CARD_DISCARDED" as const,
      playerId: target,
      card,
      from: "deck" as const,
    }));
    return [...revealEvents, ...discardEvents];
  }

  if (trashable.length === 1) {
    const toTrash = trashable[0];
    if (!toTrash) return [];
    const trashEvent: GameEvent = {
      type: "CARD_TRASHED",
      playerId: target,
      card: toTrash,
      from: "deck",
    };
    const remaining = revealed.filter(c => c !== toTrash);
    const discardEvents = remaining.map(card => ({
      type: "CARD_DISCARDED" as const,
      playerId: target,
      card,
      from: "deck" as const,
    }));
    return [...revealEvents, trashEvent, ...discardEvents];
  }

  return revealEvents;
}

export const bandit = createOpponentIteratorEffect<BanditAttackData>(
  {
    filter: (opponent, state) => {
      const oppState = state.players[opponent];
      if (!oppState) return null;

      const { cards: revealed } = peekDraw(oppState, BANDIT_REVEAL_COUNT);
      if (revealed.length === 0) return null;

      const trashable = revealed.filter(
        c => CARDS[c].types.includes("treasure") && c !== "Copper",
      );

      // Only create decision if 2+ trashable treasures
      if (trashable.length > 1) {
        return {
          opponent,
          data: { opponent, revealed, trashable },
        };
      }

      return null;
    },
    createDecision: (
      { opponent, data },
      remainingOpponents,
      attackingPlayer,
      cardName,
    ) => ({
      choiceType: "decision",
      playerId: opponent,
      from: "revealed",
      prompt: `${cardName} Attack: Choose which Treasure to trash`,
      cardOptions: data.trashable,
      min: 1,
      max: 1,
      cardBeingPlayed: cardName,
      stage: STAGES.VICTIM_TRASH_CHOICE,
      metadata: {
        revealed: data.revealed,
        remainingOpponents,
        attackingPlayer,
      },
    }),
    processChoice: (choice, { opponent, data }) => {
      const toTrash = choice.selectedCards[0];
      if (!toTrash) return [];

      const trashEvent: GameEvent = {
        type: "CARD_TRASHED",
        playerId: opponent,
        card: toTrash,
        from: "deck",
      };

      const remaining = data.revealed.filter(c => c !== toTrash);
      const discardEvents = remaining.map(card => ({
        type: "CARD_DISCARDED" as const,
        playerId: opponent,
        card,
        from: "deck" as const,
      }));

      return [trashEvent, ...discardEvents];
    },
    stage: STAGES.VICTIM_TRASH_CHOICE,
  },
  (state, playerId, attackTargets) => {
    // Initial events: Gain Gold + auto-process all opponents without choices
    const gainGold: GameEvent = {
      type: "CARD_GAINED",
      playerId,
      card: "Gold",
      to: "discard",
    };

    const targets = attackTargets ?? getOpponents(state, playerId);
    const autoProcessEvents = targets.flatMap(t =>
      processOpponentAutoAttack(state, t),
    );

    return [gainGold, ...autoProcessEvents];
  },
);
