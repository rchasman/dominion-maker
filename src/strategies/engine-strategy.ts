import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import {
  playAction,
  playTreasure,
  playAllTreasures,
  unplayTreasure,
  buyCard,
  endActionPhase,
  endBuyPhase,
  runSimpleAITurn,
  resolveDecision,
} from "../lib/game-engine";
import { isActionCard, isTreasureCard, CARDS } from "../data/cards";

export class EngineStrategy implements GameStrategy {
  async handleCardPlay(state: GameState, card: CardName): Promise<GameState> {
    // If there's a pending decision, this is resolving it
    if (state.pendingDecision) {
      // Check if this is a valid option (could be card name or text option)
      if (state.pendingDecision.options.includes(card)) {
        return resolveDecision(state, [card]);
      }

      // For choose_card_from_options with text choices, card parameter is the text choice
      if (state.pendingDecision.type === "choose_card_from_options") {
        // The "card" parameter is actually the text choice (e.g., "Trash", "Keep")
        return resolveDecision(state, [card]);
      }
    }

    const { phase, actions } = state;

    // Action phase: play action cards
    if (phase === "action" && isActionCard(card) && actions > 0) {
      return playAction(state, card);
    }

    // Buy phase: play treasures
    if (phase === "buy" && isTreasureCard(card)) {
      return playTreasure(state, card);
    }

    return state;
  }

  async handleBuyCard(state: GameState, card: CardName): Promise<GameState> {
    // If there's a pending decision for gaining, this resolves it
    if (state.pendingDecision && state.pendingDecision.type === "gain" && state.pendingDecision.options.includes(card)) {
      return resolveDecision(state, [card]);
    }

    if (state.phase !== "buy" || state.buys < 1) {
      return state;
    }
    return buyCard(state, card);
  }

  async handlePlayAllTreasures(state: GameState): Promise<GameState> {
    if (state.phase !== "buy") {
      return state;
    }
    return playAllTreasures(state);
  }

  async handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState> {
    if (state.phase !== "buy") {
      return state;
    }
    return unplayTreasure(state, card);
  }

  async handleEndPhase(state: GameState): Promise<GameState> {
    // If there's a skippable pending decision, resolve it with empty selection
    if (state.pendingDecision && state.pendingDecision.canSkip) {
      return resolveDecision(state, []);
    }

    if (state.phase === "action") {
      return endActionPhase(state);
    } else if (state.phase === "buy") {
      return endBuyPhase(state);
    }
    return state;
  }

  async runAITurn(state: GameState, onStateChange?: (state: GameState) => void): Promise<GameState> {
    // Run incrementally so UI can update after each action
    let current = state;
    const delay = () => new Promise(resolve => setTimeout(resolve, 300));

    // ACTION PHASE: Play action cards
    while (current.phase === "action" && current.actions > 0 && !current.gameOver) {
      const hand = current.players.ai.hand;
      const actionCards = hand.filter(isActionCard);
      if (actionCards.length === 0) break;

      // Pick best action by priority
      const priorities: Record<string, number> = {
        "Village": 100, "Festival": 95, "Market": 90,
        "Laboratory": 80, "Smithy": 75, "Council Room": 70, "Moat": 65, "Witch": 60,
        "Moneylender": 45, "Mine": 40, "Militia": 25,
        "Workshop": 20, "Remodel": 18, "Chapel": 12,
      };
      actionCards.sort((a, b) => (priorities[b] ?? 0) - (priorities[a] ?? 0));

      current = playAction(current, actionCards[0]);
      onStateChange?.(current);
      await delay();
    }

    // End action phase
    current = endActionPhase(current);
    onStateChange?.(current);
    await delay();

    // BUY PHASE: Play all treasures
    current = playAllTreasures(current);
    onStateChange?.(current);
    await delay();

    // Buy best card we can afford
    const buyPriority: CardName[] = [
      "Province", "Gold", "Duchy", "Laboratory", "Market", "Festival",
      "Silver", "Smithy", "Village", "Workshop", "Chapel", "Estate"
    ];

    while (current.buys > 0 && current.coins > 0 && !current.gameOver) {
      let bought = false;
      for (const card of buyPriority) {
        if (current.supply[card] > 0 && CARDS[card].cost <= current.coins) {
          current = buyCard(current, card);
          onStateChange?.(current);
          await delay();
          bought = true;
          break;
        }
      }
      if (!bought) break;
    }

    // End turn
    current = endBuyPhase(current);
    onStateChange?.(current);

    return current;
  }

  async resolveAIPendingDecision(state: GameState): Promise<GameState> {
    const decision = state.pendingDecision;
    if (!decision || decision.player !== "ai") {
      return state;
    }

    // For discard decisions (e.g., Militia attack), use hardcoded logic
    if (decision.type === "discard" && decision.metadata?.cardBeingPlayed === "Militia") {
      const aiPlayer = state.players.ai;
      const cardsToDiscard = decision.metadata.totalNeeded as number;
      const alreadyDiscarded = decision.metadata.discardedCount as number;
      const remainingToDiscard = cardsToDiscard - alreadyDiscarded;

      // Priority: Victory cards > Curses > Coppers > others
      const priorities = ["Estate", "Duchy", "Province", "Curse", "Copper"];
      let selectedCard: CardName | null = null;

      for (const priority of priorities) {
        if (aiPlayer.hand.includes(priority as CardName)) {
          selectedCard = priority as CardName;
          break;
        }
      }

      // If no priority cards, just pick first card
      if (!selectedCard && aiPlayer.hand.length > 0) {
        selectedCard = aiPlayer.hand[0];
      }

      if (selectedCard) {
        // Resolve the decision with the selected card
        return resolveDecision(state, [selectedCard]);
      }
    }

    // For other AI decisions, just skip if possible or pick first option
    if (decision.canSkip) {
      return resolveDecision(state, []);
    } else if (decision.options.length > 0) {
      return resolveDecision(state, [decision.options[0] as CardName]);
    }

    return state;
  }

  getModeName(): string {
    return "Hard-coded Engine";
  }
}
