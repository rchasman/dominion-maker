/**
 * Bandit - Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import {
  getOpponents,
  peekDraw,
  createCardSelectionDecision,
} from "../effect-types";
import type { GameEvent, PlayerId } from "../../events/types";
import type { GameState } from "../../types/game-state";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";

const BANDIT_REVEAL_COUNT = 2;

type BanditAttackData = {
  revealed: CardName[];
  trashable: CardName[];
};

/**
 * Find next opponent who needs to make a trash choice
 */
function findOpponentNeedingChoice(
  state: GameState,
  opponents: PlayerId[],
  attackingPlayer: PlayerId,
): { opponent: PlayerId; attackData: BanditAttackData } | null {
  for (const opp of opponents) {
    const oppState = state.players[opp];
    if (!oppState) continue;

    const { cards: revealed } = peekDraw(oppState, BANDIT_REVEAL_COUNT);
    if (revealed.length === 0) continue;

    const trashable = revealed.filter(
      c => CARDS[c].types.includes("treasure") && c !== "Copper",
    );

    // Only ask if there are multiple trashable treasures
    if (trashable.length > 1) {
      return {
        opponent: opp,
        attackData: { revealed, trashable },
      };
    }
  }
  return null;
}

/**
 * Process a single opponent's attack (when no choice needed)
 */
function processOpponentAutoAttack(
  state: GameState,
  opp: PlayerId,
): GameEvent[] {
  const oppState = state.players[opp];
  if (!oppState) return [];

  const { cards: revealed } = peekDraw(oppState, BANDIT_REVEAL_COUNT);
  if (revealed.length === 0) return [];

  const revealEvents: GameEvent[] = revealed.map(card => ({
    type: "CARD_REVEALED" as const,
    player: opp,
    card,
    from: "deck" as const,
  }));

  const trashable = revealed.filter(
    c => CARDS[c].types.includes("treasure") && c !== "Copper",
  );

  if (trashable.length === 0) {
    // No treasures to trash, discard all
    const discardEvents = revealed.map(card => ({
      type: "CARD_DISCARDED" as const,
      player: opp,
      card,
      from: "deck" as const,
    }));
    return [...revealEvents, ...discardEvents];
  }

  if (trashable.length === 1) {
    // Only one treasure, auto-trash it
    const toTrash = trashable[0];
    const trashEvent: GameEvent = {
      type: "CARD_TRASHED",
      player: opp,
      card: toTrash,
      from: "deck",
    };
    const remaining = revealed.filter(c => c !== toTrash);
    const discardEvents = remaining.map(card => ({
      type: "CARD_DISCARDED" as const,
      player: opp,
      card,
      from: "deck" as const,
    }));
    return [...revealEvents, trashEvent, ...discardEvents];
  }

  // Multiple trashable - this shouldn't happen in auto-attack, but handle gracefully
  return revealEvents;
}

export const bandit: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const opponents = getOpponents(state, player);

  // Initial call: Gain Gold, then process opponents
  if (!decision || stage === undefined) {
    const events: GameEvent[] = state.supply.Gold > 0
      ? [{ type: "CARD_GAINED", player, card: "Gold", to: "discard" }]
      : [];

    // Process all opponents who don't need a choice
    const autoAttackEvents = opponents.flatMap(opp =>
      processOpponentAutoAttack(state, opp),
    );
    events.push(...autoAttackEvents);

    // Check if any opponent needs to make a choice
    const needsChoice = findOpponentNeedingChoice(state, opponents, player);
    if (needsChoice) {
      const { opponent, attackData } = needsChoice;
      const remainingOpponents = opponents.filter(o => o !== opponent);

      return {
        events,
        pendingDecision: createCardSelectionDecision({
          player: opponent,
          from: "revealed",
          prompt: "Bandit Attack: Choose which Treasure to trash",
          cardOptions: attackData.trashable,
          min: 1,
          max: 1,
          cardBeingPlayed: "Bandit",
          stage: "victim_trash_choice",
          metadata: {
            revealed: attackData.revealed,
            remainingOpponents,
            attackingPlayer: player,
          },
        }),
      };
    }

    return { events };
  }

  // Process victim's trash choice
  if (stage === "victim_trash_choice" && decision) {
    const toTrash = decision.selectedCards[0];
    const victimPlayer = state.pendingDecision?.player;
    if (!victimPlayer) return { events: [] };

    const metadata = state.pendingDecision?.metadata;
    const revealed = (metadata?.revealed as CardName[]) || [];
    const remainingOpponents = (metadata?.remainingOpponents as PlayerId[]) || [];
    const attackingPlayer = (metadata?.attackingPlayer as PlayerId) || player;

    // Trash chosen card, discard the rest
    const trashEvent: GameEvent = {
      type: "CARD_TRASHED",
      player: victimPlayer,
      card: toTrash,
      from: "deck",
    };
    const remaining = revealed.filter(c => c !== toTrash);
    const discardEvents = remaining.map(card => ({
      type: "CARD_DISCARDED" as const,
      player: victimPlayer,
      card,
      from: "deck" as const,
    }));

    const events: GameEvent[] = [trashEvent, ...discardEvents];

    // Check if more opponents need choices
    const needsChoice = findOpponentNeedingChoice(
      state,
      remainingOpponents,
      attackingPlayer,
    );
    if (needsChoice) {
      const { opponent, attackData } = needsChoice;
      const nextRemaining = remainingOpponents.filter(o => o !== opponent);

      return {
        events,
        pendingDecision: createCardSelectionDecision({
          player: opponent,
          from: "revealed",
          prompt: "Bandit Attack: Choose which Treasure to trash",
          cardOptions: attackData.trashable,
          min: 1,
          max: 1,
          cardBeingPlayed: "Bandit",
          stage: "victim_trash_choice",
          metadata: {
            revealed: attackData.revealed,
            remainingOpponents: nextRemaining,
            attackingPlayer,
          },
        }),
      };
    }

    return { events };
  }

  return { events: [] };
};
