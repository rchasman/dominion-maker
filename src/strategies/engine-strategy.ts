/**
 * Engine Strategy - Simple priority-based AI using event-sourced DominionEngine
 */

import type { GameStrategy } from "../types/game-mode";
import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import { isActionCard, isTreasureCard, CARDS } from "../data/cards";

export class EngineStrategy implements GameStrategy {
  async runAITurn(
    engine: DominionEngine,
    onStateChange?: (state: GameState) => void,
  ): Promise<void> {
    const delay = () => new Promise(resolve => setTimeout(resolve, 300));

    // ACTION PHASE: Play action cards with priority
    while (
      engine.state.phase === "action" &&
      engine.state.actions > 0 &&
      !engine.state.gameOver
    ) {
      const hand = engine.state.players.ai?.hand || [];
      const actionCards = hand.filter(isActionCard);
      if (actionCards.length === 0) break;

      // Priority: Village/cantrips > draw > money > attacks > gain/trash
      const priorities: Record<string, number> = {
        Village: 100,
        Festival: 95,
        Market: 90,
        Laboratory: 80,
        Smithy: 75,
        "Council Room": 70,
        Moat: 65,
        Witch: 60,
        Militia: 25,
        Moneylender: 45,
        Mine: 40,
        Workshop: 20,
        Remodel: 18,
        Chapel: 12,
      };
      actionCards.sort((a, b) => (priorities[b] ?? 0) - (priorities[a] ?? 0));

      const result = engine.dispatch(
        { type: "PLAY_ACTION", player: "ai", card: actionCards[0] },
        "ai",
      );
      if (!result.ok) break;

      onStateChange?.(engine.state);
      await delay();
    }

    // End action phase
    engine.dispatch({ type: "END_PHASE", player: "ai" }, "ai");
    onStateChange?.(engine.state);
    await delay();

    // BUY PHASE: Play all treasures
    const treasures = (engine.state.players.ai?.hand || []).filter(
      isTreasureCard,
    );
    for (const treasure of treasures) {
      engine.dispatch(
        { type: "PLAY_TREASURE", player: "ai", card: treasure },
        "ai",
      );
    }
    onStateChange?.(engine.state);
    await delay();

    // Buy best cards we can afford
    const buyPriority: CardName[] = [
      "Province",
      "Gold",
      "Duchy",
      "Laboratory",
      "Market",
      "Festival",
      "Silver",
      "Smithy",
      "Village",
      "Workshop",
      "Chapel",
      "Estate",
    ];

    while (
      engine.state.buys > 0 &&
      engine.state.coins > 0 &&
      !engine.state.gameOver
    ) {
      let bought = false;
      for (const card of buyPriority) {
        const supply = engine.state.supply[card] || 0;
        const cost = CARDS[card].cost;
        if (supply > 0 && cost <= engine.state.coins) {
          const result = engine.dispatch(
            { type: "BUY_CARD", player: "ai", card },
            "ai",
          );
          if (result.ok) {
            onStateChange?.(engine.state);
            await delay();
            bought = true;
            break;
          }
        }
      }
      if (!bought) break;
    }

    // End turn
    engine.dispatch({ type: "END_PHASE", player: "ai" }, "ai");
    onStateChange?.(engine.state);
  }

  async resolveAIPendingDecision(engine: DominionEngine): Promise<void> {
    const decision = engine.state.pendingDecision;
    if (!decision || decision.player !== "ai") return;

    // For discard decisions (e.g., Militia attack), discard worst cards
    if (decision.stage === "opponent_discard" || decision.stage === "discard") {
      const aiPlayer = engine.state.players.ai;
      if (!aiPlayer) return;

      const numToDiscard = decision.min;

      // Priority for discarding: Victory cards > Curses > Coppers > expensive cards > cheap cards
      const priorities = ["Estate", "Duchy", "Province", "Curse", "Copper"];
      const selected: CardName[] = [];
      const options = decision.cardOptions || aiPlayer.hand;

      // First pick priority discard cards
      for (const priority of priorities) {
        const matchingCards = options.filter(c => c === priority);
        for (const card of matchingCards) {
          if (selected.length < numToDiscard) {
            selected.push(card);
          }
        }
      }

      // Fill remaining with most expensive cards (they're worth less early)
      if (selected.length < numToDiscard) {
        const remaining = options
          .filter(c => !selected.includes(c))
          .sort((a, b) => CARDS[b].cost - CARDS[a].cost);

        selected.push(...remaining.slice(0, numToDiscard - selected.length));
      }

      engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "ai",
          choice: { selectedCards: selected },
        },
        "ai",
      );
      return;
    }

    // For trash decisions, trash worst cards (Chapel, Mine, Remodel)
    if (decision.stage === "trash") {
      const aiPlayer = engine.state.players.ai;
      if (!aiPlayer) return;

      const options = decision.cardOptions || [];
      const numToTrash = decision.min;

      // Priority for trashing: Curses > Estates > Coppers > low-cost cards
      const trashPriorities = ["Curse", "Estate", "Copper"];
      const selected: CardName[] = [];

      // First pick priority trash cards
      for (const priority of trashPriorities) {
        const matchingCards = options.filter(c => c === priority);
        for (const card of matchingCards) {
          if (selected.length < numToTrash) {
            selected.push(card);
          }
        }
      }

      // Fill remaining with cheapest cards
      if (selected.length < numToTrash) {
        const remaining = options
          .filter(c => !selected.includes(c))
          .sort((a, b) => CARDS[a].cost - CARDS[b].cost); // Cheapest first

        selected.push(...remaining.slice(0, numToTrash - selected.length));
      }

      engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "ai",
          choice: { selectedCards: selected },
        },
        "ai",
      );
      return;
    }

    // For gain decisions, gain best available card
    if (decision.stage === "gain") {
      const options = decision.cardOptions || [];

      // Gain most expensive card available (simple heuristic)
      const sorted = [...options].sort((a, b) => CARDS[b].cost - CARDS[a].cost);
      const selected = sorted.slice(0, decision.min);

      engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "ai",
          choice: { selectedCards: selected },
        },
        "ai",
      );
      return;
    }

    // For other decisions, pick first min options or skip
    const options = decision.cardOptions || [];
    if (decision.min === 0) {
      // Skip if possible
      engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "ai",
          choice: { selectedCards: [] },
        },
        "ai",
      );
    } else {
      // Pick first min options
      const selected = options.slice(0, decision.min);
      engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "ai",
          choice: { selectedCards: selected },
        },
        "ai",
      );
    }
  }

  getModeName(): string {
    return "Hard-coded Engine";
  }
}
