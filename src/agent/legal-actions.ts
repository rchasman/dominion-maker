// Shared by client and generate-action endpoint — both MUST derive from the
// same state or the numbered-choice mapping disagrees

import type { GameState, CardName } from "../types/game-state";
import type { Action } from "../types/action";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { decomposeDecisionForAI } from "./decision-decomposer";
import { isReactionChoice, isDecisionChoice } from "../types/pending-choice";

function withSkipOption<T extends Action>(
  actions: T[],
  canSkip: boolean,
): Action[] {
  return canSkip ? [...actions, { type: "skip_decision" as const }] : actions;
}

export function getLegalActions(state: GameState): Action[] {
  // Handle reactions first (separate from decisions)
  if (isReactionChoice(state.pendingChoice)) {
    const reaction = state.pendingChoice;
    return [
      ...reaction.availableReactions.map(card => ({
        type: "reveal_reaction" as const,
        card,
      })),
      { type: "decline_reaction" as const },
    ];
  }

  // Pending decision actions - use decision.playerId, not activePlayer!
  // (e.g., Militia makes opponent discard while human is still active)
  if (isDecisionChoice(state.pendingChoice)) {
    const decision = state.pendingChoice;
    const decisionPlayer = decision.playerId;
    const playerState = state.players[decisionPlayer];
    if (!playerState) return [];

    const options = decision.cardOptions || [];
    const canSkip = decision.min === 0;

    // Check if this is a decision with custom actions (like Sentry)
    if (
      decision.actions &&
      decision.actions.length > 0 &&
      !decision.actions.every(a => a.id === "select" || a.id === "skip")
    ) {
      return decomposeDecisionForAI(decision);
    }

    // Check if this is a batch decision that needs decomposition for AI
    if ((decision.max ?? 1) > 1) {
      return decomposeDecisionForAI(decision);
    }

    if (
      decision.stage === "trash" ||
      decision.stage === "victim_trash_choice"
    ) {
      return withSkipOption(
        options.map(card => ({ type: "trash_card" as const, card })),
        canSkip,
      );
    }

    if (decision.stage === "discard" || decision.stage === "opponent_discard") {
      return withSkipOption(
        options.map(card => ({ type: "discard_card" as const, card })),
        canSkip,
      );
    }

    if (decision.stage === "gain" || decision.from === "supply") {
      return withSkipOption(
        options.map(card => ({ type: "gain_card" as const, card })),
        canSkip,
      );
    }

    if (decision.stage === "topdeck" || decision.stage === "opponent_topdeck") {
      return withSkipOption(
        options.map(card => ({ type: "topdeck_card" as const, card })),
        canSkip,
      );
    }

    if (
      decision.stage === "choose_action" ||
      decision.stage === "play_action"
    ) {
      return withSkipOption(
        options.map(card => ({ type: "play_action" as const, card })),
        canSkip,
      );
    }

    return [];
  }

  // No pending decision - use active player
  const player = state.activePlayerId;
  const playerState = state.players[player];
  if (!playerState) return [];

  // Action phase
  if (state.phase === "action") {
    const actionCards = playerState.hand.filter(isActionCard);
    const playActions =
      state.actions > 0
        ? actionCards.map(card => ({ type: "play_action" as const, card }))
        : [];
    return [...playActions, { type: "end_phase" }];
  }

  // Buy phase
  if (state.phase === "buy") {
    const treasures = playerState.hand.filter(isTreasureCard);
    const playTreasures = treasures.map(card => ({
      type: "play_treasure" as const,
      card,
    }));

    // Buyable cards
    const buyableCards = Object.entries(state.supply)
      .filter(([card, count]) => {
        const cardName = card as CardName;
        return (
          count > 0 && CARDS[cardName]?.cost <= state.coins && state.buys > 0
        );
      })
      .map(([card]) => ({ type: "buy_card" as const, card: card as CardName }));

    return [...playTreasures, ...buyableCards, { type: "end_phase" }];
  }

  return [];
}
