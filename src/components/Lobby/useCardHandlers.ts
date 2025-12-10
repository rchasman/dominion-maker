import { useCallback } from "react";
import { uiLogger } from "../../lib/logger";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { getDisplayState } from "./game-board-helpers";
import type { CardName, GameState } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";

const ZERO = 0;
const DEFAULT_MAX_DECISION_COUNT = 1;

interface CardHandlersParams {
  validPreviewEventId: string | null;
  isMyTurn: boolean;
  gameState: GameState | null;
  selectedCardIndices: number[];
  setSelectedCardIndices: (updater: (prev: number[]) => number[]) => void;
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  submitDecision: (choice: { selectedCards: CardName[] }) => CommandResult;
  getStateAtEvent: (eventId: string) => GameState;
}

export function useCardHandlers(params: CardHandlersParams) {
  const {
    validPreviewEventId,
    isMyTurn,
    gameState,
    selectedCardIndices,
    setSelectedCardIndices,
    playAction,
    playTreasure,
    buyCard,
    submitDecision,
    getStateAtEvent,
  } = params;

  const handleCardClick = useCallback(
    (card: CardName, index: number) => {
      if (validPreviewEventId !== null || !isMyTurn) return;

      const displayState = getDisplayState(
        validPreviewEventId,
        gameState,
        getStateAtEvent,
      );
      if (!displayState) return;

      if (displayState.pendingDecision) {
        const maxCount =
          displayState.pendingDecision.max ?? DEFAULT_MAX_DECISION_COUNT;
        if (selectedCardIndices.includes(index)) {
          setSelectedCardIndices(prev => prev.filter(i => i !== index));
        } else if (selectedCardIndices.length < maxCount) {
          setSelectedCardIndices(prev => [...prev, index]);
        }
        return;
      }

      if (
        displayState.phase === "action" &&
        isActionCard(card) &&
        displayState.actions > ZERO
      ) {
        const result = playAction(card);
        if (!result.ok) uiLogger.error("Failed to play action:", result.error);
        return;
      }

      if (displayState.phase === "buy" && isTreasureCard(card)) {
        const result = playTreasure(card);
        if (!result.ok)
          uiLogger.error("Failed to play treasure:", result.error);
      }
    },
    [
      isMyTurn,
      gameState,
      selectedCardIndices,
      playAction,
      playTreasure,
      validPreviewEventId,
      getStateAtEvent,
      setSelectedCardIndices,
    ],
  );

  const handleBuyCard = useCallback(
    (card: CardName) => {
      if (validPreviewEventId !== null) return;
      const displayState = getDisplayState(
        validPreviewEventId,
        gameState,
        getStateAtEvent,
      );
      if (!displayState) return;

      // If there's a pending decision from supply, submit the decision
      if (displayState.pendingDecision?.from === "supply") {
        const result = submitDecision({ selectedCards: [card] });
        if (!result.ok)
          uiLogger.error("Failed to submit decision:", result.error);
        return;
      }

      const canBuy =
        isMyTurn &&
        displayState.phase === "buy" &&
        displayState.buys > ZERO &&
        !validPreviewEventId;
      if (!canBuy) return;

      const result = buyCard(card);
      if (!result.ok) uiLogger.error("Failed to buy card:", result.error);
    },
    [
      isMyTurn,
      gameState,
      buyCard,
      submitDecision,
      validPreviewEventId,
      getStateAtEvent,
    ],
  );

  return { handleCardClick, handleBuyCard };
}
