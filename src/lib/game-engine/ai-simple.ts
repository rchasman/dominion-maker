import type { CardName, GameState } from "../../types/game-state";
import { CARDS, isActionCard } from "../../data/cards";
import { playAction } from "./actions";
import { playAllTreasures } from "./treasures";
import { buyCard, endActionPhase, endBuyPhase } from "./phases";

// Helper: Rank action cards by priority for AI play order
function getActionPlayPriority(card: CardName): number {
  // Higher number = play first
  const priorities: Record<string, number> = {
    // Villages first (they give net +actions)
    "Village": 100,
    "Festival": 95,
    "Market": 90,

    // Card draw next
    "Laboratory": 80,
    "Smithy": 75,
    "Council Room": 70,
    "Moat": 65,
    "Witch": 60,
    "Harbinger": 55,
    "Merchant": 50,

    // Economy cards
    "Moneylender": 45,
    "Mine": 40,
    "Vassal": 35,
    "Poacher": 30,
    "Militia": 25,

    // Gainers
    "Workshop": 20,
    "Remodel": 18,
    "Artisan": 15,

    // Trashers (only trash if hand is bad)
    "Chapel": 12,
    "Cellar": 10,

    // Complex cards (simplified implementation)
    "Throne Room": 5,
    "Bandit": 4,
    "Bureaucrat": 3,
    "Library": 2,
    "Sentry": 1,
  };

  return priorities[card] ?? 0;
}

// Smart AI: play actions intelligently, then treasures, then buy
export function runSimpleAITurn(state: GameState): GameState {
  if (state.activePlayer !== "ai" || state.gameOver) return state;

  let current: GameState = state;

  // ACTION PHASE: Play action cards intelligently
  while (current.phase === "action" && current.actions > 0) {
    const hand = current.players.ai.hand;
    const actionCards = hand.filter(isActionCard);

    if (actionCards.length === 0) {
      // No more actions to play
      break;
    }

    // Sort by priority and play the best one
    actionCards.sort((a, b) => getActionPlayPriority(b) - getActionPlayPriority(a));
    const bestAction = actionCards[0];

    // Play the action
    current = playAction(current, bestAction);

    // Safety check: if state didn't change, break to avoid infinite loop
    if (current === state) break;
  }

  // End action phase
  current = endActionPhase(current);

  // BUY PHASE: Play all treasures
  current = playAllTreasures(current);

  // Buy best card we can afford
  const buyPriority: CardName[] = [
    "Province",    // 8 - Win condition
    "Gold",        // 6 - Best treasure
    "Duchy",       // 5 - VP
    "Artisan",     // 6 - Gain Silver + topdeck
    "Laboratory",  // 5 - Cantrip with draw
    "Market",      // 5 - Best all-rounder
    "Mine",        // 5 - Upgrade treasures
    "Witch",       // 5 - Card draw + attack
    "Festival",    // 5 - Economy
    "Council Room", // 5 - Big draw
    "Silver",      // 3 - Good treasure
    "Smithy",      // 4 - Draw
    "Remodel",     // 4 - Trasher/gainer
    "Village",     // 3 - Actions
    "Workshop",    // 3 - Gainer
    "Militia",     // 4 - Economy + attack
    "Chapel",      // 2 - Trasher
    "Estate"       // 2 - Last resort VP
  ];

  while (current.buys > 0 && current.coins > 0) {
    let bought = false;
    for (const card of buyPriority) {
      if (current.supply[card] > 0 && CARDS[card].cost <= current.coins) {
        current = buyCard(current, card);
        bought = true;
        break;
      }
    }
    if (!bought) break;
  }

  // End turn
  current = endBuyPhase(current);

  return current;
}
