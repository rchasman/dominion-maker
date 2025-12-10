/**
 * Bandit - Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import {
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
  targets: PlayerId[],
): { opponent: PlayerId; attackData: BanditAttackData } | null {
  for (const target of targets) {
    const targetState = state.players[target];
    if (!targetState) continue;

    const { cards: revealed } = peekDraw(targetState, BANDIT_REVEAL_COUNT);
    if (revealed.length === 0) continue;

    const trashable = revealed.filter(
      c => CARDS[c].types.includes("treasure") && c !== "Copper",
    );

    // Only ask if there are multiple trashable treasures
    if (trashable.length > 1) {
      return {
        opponent: target,
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
  target: PlayerId,
): GameEvent[] {
  const targetState = state.players[target];
  if (!targetState) return [];

  const { cards: revealed } = peekDraw(targetState, BANDIT_REVEAL_COUNT);
  if (revealed.length === 0) return [];

  const revealEvents: GameEvent[] = revealed.map(card => ({
    type: "CARD_REVEALED" as const,
    player: target,
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
      player: target,
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
      player: target,
      card: toTrash,
      from: "deck",
    };
    const remaining = revealed.filter(c => c !== toTrash);
    const discardEvents = remaining.map(card => ({
      type: "CARD_DISCARDED" as const,
      player: target,
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
  attackTargets,
  decision,
  stage,
}): CardEffectResult => {
  // Gain Gold (apply layer will handle supply depletion)
  const gainGoldEvents: GameEvent[] = [
    { type: "CARD_GAINED" as const, player, card: "Gold" as const, to: "discard" as const },
  ];

  // Engine auto-handles reactions, provides resolved targets
  if (!stage && attackTargets) {
    const needsChoice = findOpponentNeedingChoice(state, attackTargets);
    if (needsChoice) {
      const { opponent, attackData } = needsChoice;
      const revealEvents = attackData.revealed.map(card => ({
        type: "CARD_REVEALED" as const,
        player: opponent,
        card,
        from: "deck" as const,
      }));
      return {
        events: [...gainGoldEvents, ...revealEvents],
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
            remainingTargets: attackTargets.filter(t => t !== opponent),
          },
        }),
      };
    }

    // All targets can be auto-processed
    const attackEvents = attackTargets.flatMap(t =>
      processOpponentAutoAttack(state, t),
    );
    return { events: [...gainGoldEvents, ...attackEvents] };
  }

  // Process victim's trash choice
  if (stage === "victim_trash_choice" && decision) {
    const toTrash = decision.selectedCards[0];
    const victimPlayer = state.pendingDecision?.player;
    if (!victimPlayer) return { events: [] };

    const metadata = state.pendingDecision?.metadata;
    const revealed = (metadata?.revealed as CardName[]) || [];
    const remainingTargets = (metadata?.remainingTargets as PlayerId[]) || [];

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

    // Check if more targets need choices
    const needsChoice = findOpponentNeedingChoice(state, remainingTargets);
    if (needsChoice) {
      const { opponent, attackData } = needsChoice;
      const revealEvents = attackData.revealed.map(card => ({
        type: "CARD_REVEALED" as const,
        player: opponent,
        card,
        from: "deck" as const,
      }));
      return {
        events: [...trashEvent, ...discardEvents, ...revealEvents],
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
            remainingTargets: remainingTargets.filter(t => t !== opponent),
          },
        }),
      };
    }

    // All remaining auto-processed
    const remainingAttackEvents = remainingTargets.flatMap(t => processOpponentAutoAttack(state, t));
    return { events: [...trashEvent, ...discardEvents, ...remainingAttackEvents] };
  }

  return { events: [] };
};
