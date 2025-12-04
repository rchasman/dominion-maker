import type { CardName, GameState } from "../../types/game-state";
import { CARDS, isTreasureCard, isActionCard } from "../../data/cards";

export function getLegalActions(state: GameState): Array<{ type: string; card?: CardName; cards?: CardName[] }> {
  const actions: Array<{ type: string; card?: CardName; cards?: CardName[] }> = [];

  // PRIORITY: Handle pending decisions first (e.g., Militia forcing opponent to discard)
  if (state.pendingDecision) {
    const decision = state.pendingDecision;

    switch (decision.type) {
      case "discard":
        for (const card of decision.options) {
          actions.push({ type: "discard_cards", cards: [card as CardName] });
        }
        break;
      case "trash":
        for (const card of decision.options) {
          actions.push({ type: "trash_cards", cards: [card as CardName] });
        }
        break;
      case "gain":
        for (const card of decision.options) {
          actions.push({ type: "gain_card", card: card as CardName });
        }
        break;
    }

    if (decision.canSkip) {
      actions.push({ type: "end_phase" });
    }

    return actions;
  }

  const player = state.activePlayer;
  const playerState = state.players[player];

  if (state.phase === "action") {
    // Can play action cards if we have actions available
    if (state.actions > 0) {
      const actionCards = playerState.hand.filter(isActionCard);
      const uniqueActions = Array.from(new Set(actionCards));
      for (const card of uniqueActions) {
        actions.push({ type: "play_action", card });
      }
    }

    // Can always end action phase
    actions.push({ type: "end_phase" });
  } else if (state.phase === "buy") {
    // Can play treasures
    const treasureCards = playerState.hand.filter(isTreasureCard);
    const uniqueTreasures = Array.from(new Set(treasureCards));
    for (const card of uniqueTreasures) {
      actions.push({ type: "play_treasure", card });
    }

    // Can buy cards if we have buys
    if (state.buys > 0) {
      for (const [cardName, count] of Object.entries(state.supply)) {
        if (count > 0) {
          const cost = CARDS[cardName as CardName]?.cost ?? 0;
          if (cost <= state.coins) {
            actions.push({ type: "buy_card", card: cardName as CardName });
          }
        }
      }
    }

    // Can always end buy phase
    actions.push({ type: "end_phase" });
  }

  return actions;
}
