/**
 * Engine Strategy - Simple priority-based AI using event-sourced DominionEngine
 */

import type { GameStrategy } from "../types/game-mode";
import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import { isActionCard, isTreasureCard, CARDS } from "../data/cards";
import { isDecisionChoice } from "../types/pending-choice";

const AI_TURN_DELAY_MS = 300;

const ACTION_PRIORITIES: Record<string, number> = {
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

const BUY_PRIORITY: CardName[] = [
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

const DISCARD_PRIORITIES: CardName[] = [
  "Estate",
  "Duchy",
  "Province",
  "Curse",
  "Copper",
];

const TRASH_PRIORITIES: CardName[] = ["Curse", "Estate", "Copper"];

const sortActionsByPriority = (actions: CardName[]): CardName[] =>
  [...actions].sort(
    (a, b) => (ACTION_PRIORITIES[b] ?? 0) - (ACTION_PRIORITIES[a] ?? 0),
  );

const selectCardsByPriority = (
  options: CardName[],
  priorities: CardName[],
  count: number,
): CardName[] => {
  const selected = priorities.reduce<CardName[]>((acc, priority) => {
    if (acc.length >= count) return acc;
    const matching = options.filter(c => c === priority);
    const toAdd = matching.slice(0, count - acc.length);
    return [...acc, ...toAdd];
  }, []);

  return selected;
};

const fillRemainingCards = (
  options: CardName[],
  selected: CardName[],
  count: number,
  compareFn: (a: CardName, b: CardName) => number,
): CardName[] => {
  if (selected.length >= count) return selected;

  const remaining = options
    .filter(c => !selected.includes(c))
    .sort(compareFn)
    .slice(0, count - selected.length);

  return [...selected, ...remaining];
};

const findAffordableCard = (
  buyPriority: CardName[],
  supply: Record<string, number>,
  coins: number,
): CardName | null => {
  const affordable = buyPriority.find(card => {
    const cardSupply = supply[card] ?? 0;
    const cost = CARDS[card].cost;
    return cardSupply > 0 && cost <= coins;
  });

  return affordable ?? null;
};

export class EngineStrategy implements GameStrategy {
  async runAITurn(
    engine: DominionEngine,
    onStateChange?: (state: GameState) => void,
  ): Promise<void> {
    const delay = async (): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve, AI_TURN_DELAY_MS));
    };

    await this.playActionPhase(engine, onStateChange, delay);
    await this.playTreasurePhase(engine, onStateChange, delay);
    await this.playBuyPhase(engine, onStateChange, delay);

    engine.dispatch({ type: "END_PHASE", playerId: "ai" }, "ai");
    onStateChange?.(engine.state);
  }

  private async playActionPhase(
    engine: DominionEngine,
    onStateChange: ((state: GameState) => void) | undefined,
    delay: () => Promise<void>,
  ): Promise<void> {
    while (
      engine.state.phase === "action" &&
      engine.state.actions > 0 &&
      !engine.state.gameOver
    ) {
      const hand = engine.state.players.ai?.hand ?? [];
      const actionCards = hand.filter(isActionCard);
      if (actionCards.length === 0) break;

      const sortedActions = sortActionsByPriority(actionCards);
      const result = engine.dispatch(
        { type: "PLAY_ACTION", playerId: "ai", card: sortedActions[0] },
        "ai",
      );

      if (!result.ok) break;

      onStateChange?.(engine.state);
      await delay();
    }

    engine.dispatch({ type: "END_PHASE", playerId: "ai" }, "ai");
    onStateChange?.(engine.state);
    await delay();
  }

  private async playTreasurePhase(
    engine: DominionEngine,
    onStateChange: ((state: GameState) => void) | undefined,
    delay: () => Promise<void>,
  ): Promise<void> {
    const treasures = (engine.state.players.ai?.hand ?? []).filter(
      isTreasureCard,
    );

    treasures.reduce((acc, treasure) => {
      engine.dispatch(
        { type: "PLAY_TREASURE", playerId: "ai", card: treasure },
        "ai",
      );
      return acc;
    }, null);

    onStateChange?.(engine.state);
    await delay();
  }

  private async playBuyPhase(
    engine: DominionEngine,
    onStateChange: ((state: GameState) => void) | undefined,
    delay: () => Promise<void>,
  ): Promise<void> {
    while (
      engine.state.buys > 0 &&
      engine.state.coins > 0 &&
      !engine.state.gameOver
    ) {
      const cardToBuy = findAffordableCard(
        BUY_PRIORITY,
        engine.state.supply,
        engine.state.coins,
      );

      if (!cardToBuy) break;

      const result = engine.dispatch(
        { type: "BUY_CARD", playerId: "ai", card: cardToBuy },
        "ai",
      );

      if (!result.ok) break;

      onStateChange?.(engine.state);
      await delay();
    }
  }

  resolveAIPendingDecision(engine: DominionEngine): void {
    const decision = engine.state.pendingChoice;
    if (!decision || decision.playerId !== "ai") return;
    if (!isDecisionChoice(decision)) return;

    if (decision.stage === "opponent_discard" || decision.stage === "discard") {
      this.handleDiscardDecision(engine);
      return;
    }

    if (decision.stage === "trash") {
      this.handleTrashDecision(engine);
      return;
    }

    if (decision.stage === "gain") {
      this.handleGainDecision(engine);
      return;
    }

    this.handleDefaultDecision(engine);
  }

  private handleDiscardDecision(engine: DominionEngine): void {
    const decision = engine.state.pendingChoice;
    const aiPlayer = engine.state.players.ai;
    if (!isDecisionChoice(decision) || !aiPlayer) return;

    const numToDiscard = decision.min ?? 0;
    const options = decision.cardOptions ?? aiPlayer.hand;

    const selected = selectCardsByPriority(
      options,
      DISCARD_PRIORITIES,
      numToDiscard,
    );

    const finalSelection = fillRemainingCards(
      options,
      selected,
      numToDiscard,
      (a, b) => CARDS[b].cost - CARDS[a].cost,
    );

    engine.dispatch(
      {
        type: "SUBMIT_DECISION",
        playerId: "ai",
        choice: { selectedCards: finalSelection },
      },
      "ai",
    );
  }

  private handleTrashDecision(engine: DominionEngine): void {
    const decision = engine.state.pendingChoice;
    if (!isDecisionChoice(decision)) return;

    const options = decision.cardOptions ?? [];
    const numToTrash = decision.min ?? 0;

    const selected = selectCardsByPriority(
      options,
      TRASH_PRIORITIES,
      numToTrash,
    );

    const finalSelection = fillRemainingCards(
      options,
      selected,
      numToTrash,
      (a, b) => CARDS[a].cost - CARDS[b].cost,
    );

    engine.dispatch(
      {
        type: "SUBMIT_DECISION",
        playerId: "ai",
        choice: { selectedCards: finalSelection },
      },
      "ai",
    );
  }

  private handleGainDecision(engine: DominionEngine): void {
    const decision = engine.state.pendingChoice;
    if (!isDecisionChoice(decision)) return;

    const options = decision.cardOptions ?? [];
    const sorted = [...options].sort((a, b) => CARDS[b].cost - CARDS[a].cost);
    const selected = sorted.slice(0, decision.min ?? 0);

    engine.dispatch(
      {
        type: "SUBMIT_DECISION",
        playerId: "ai",
        choice: { selectedCards: selected },
      },
      "ai",
    );
  }

  private handleDefaultDecision(engine: DominionEngine): void {
    const decision = engine.state.pendingChoice;
    if (!isDecisionChoice(decision)) return;

    const options = decision.cardOptions ?? [];
    const minCount = decision.min ?? 0;
    const selected = minCount === 0 ? [] : options.slice(0, minCount);

    engine.dispatch(
      {
        type: "SUBMIT_DECISION",
        playerId: "ai",
        choice: { selectedCards: selected },
      },
      "ai",
    );
  }

  getModeName(): string {
    return "Hard-coded Engine";
  }
}
