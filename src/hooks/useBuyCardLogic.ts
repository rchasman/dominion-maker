/**
 * Shared hook for buy card logic that checks for pending decisions from supply.
 *
 * When cards like Workshop, Artisan, Remodel, or Mine create a pending decision
 * with from="supply", clicking a supply card should submit the decision rather
 * than executing a buy action.
 *
 * This hook consolidates the logic used in both Lobby (multiplayer) and Board
 * (single-player) modes to prevent divergence.
 */

import { useCallback } from "preact/hooks";
import type { CardName } from "../types/game-state";
import type { CommandResult } from "../commands/types";
import type { DecisionRequest } from "../events/types";
import { uiLogger } from "../lib/logger";

interface BuyCardLogicParams {
  buyCard: (card: CardName) => CommandResult;
  submitDecision: (choice: { selectedCards: CardName[] }) => CommandResult;
  pendingDecision?: DecisionRequest | null;
}

/**
 * Returns a buy card handler that routes to submitDecision when appropriate.
 */
export function useBuyCardLogic({
  buyCard,
  submitDecision,
  pendingDecision,
}: BuyCardLogicParams): (card: CardName) => CommandResult {
  return useCallback(
    (card: CardName): CommandResult => {
      // If there's a pending decision from supply, submit the decision
      if (pendingDecision?.from === "supply") {
        const result = submitDecision({ selectedCards: [card] });
        if (!result.ok) {
          uiLogger.error("Failed to submit decision:", result.error);
        }
        return result;
      }

      // Otherwise, buy the card normally
      const result = buyCard(card);
      if (!result.ok) {
        uiLogger.error("Failed to buy card:", result.error);
      }
      return result;
    },
    [buyCard, submitDecision, pendingDecision],
  );
}
