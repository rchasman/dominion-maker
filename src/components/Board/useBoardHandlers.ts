import { useCallback } from "preact/hooks";
import type { CardName, GameState } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";
import type { DecisionChoice } from "../../events/types";
import { shouldSelectCard, canPlayCard } from "./helpers";
import type { ComplexDecisionData } from "./hooks";

interface BoardHandlersParams {
  gameState: GameState | null;
  selectedCardIndices: number[];
  toggleCardSelection: (index: number) => void;
  addCardSelection: (index: number) => void;
  clearSelection: () => void;
  clearComplexDecision: () => void;
  handlePlayAction: (card: CardName) => CommandResult;
  handlePlayTreasure: (card: CardName) => CommandResult;
  handleUnplayTreasure: (card: CardName) => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
}

function submitComplexDecision(
  data: ComplexDecisionData,
  submitDecision: (choice: DecisionChoice) => CommandResult,
): CommandResult {
  return submitDecision({
    selectedCards: [],
    cardActions: data.cardActions,
    cardOrder: data.cardOrder,
  });
}

function submitSimpleDecision(
  selectedCardIndices: number[],
  mainPlayerId: string,
  gameState: GameState,
  submitDecision: (choice: DecisionChoice) => CommandResult,
): CommandResult {
  const mainPlayer = gameState.players[mainPlayerId];
  if (!mainPlayer) {
    return { ok: false, error: "No main player" };
  }

  const selectedCards = selectedCardIndices.map(i => mainPlayer.hand[i]);
  return submitDecision({ selectedCards });
}

export function useBoardHandlers(params: BoardHandlersParams) {
  const {
    gameState,
    selectedCardIndices,
    toggleCardSelection,
    addCardSelection,
    clearSelection,
    clearComplexDecision,
    handlePlayAction,
    handlePlayTreasure,
    handleUnplayTreasure,
    submitDecision,
  } = params;

  const handleCardClick = useCallback(
    (card: CardName, index: number, mainPlayerId: string) => {
      if (!gameState?.activePlayer || gameState.activePlayer !== mainPlayerId) {
        return;
      }

      if (gameState.pendingDecision) {
        const selection = shouldSelectCard(
          index,
          selectedCardIndices,
          gameState.pendingDecision,
        );

        if (selection.shouldToggleOff) {
          toggleCardSelection(index);
        } else if (selection.canAdd) {
          addCardSelection(index);
        }
        return;
      }

      const canPlay = canPlayCard(
        card,
        gameState.phase,
        gameState.actions,
        gameState.activePlayer === mainPlayerId,
      );

      if (canPlay.canPlayAction) {
        handlePlayAction(card);
      } else if (canPlay.canPlayTreasure) {
        handlePlayTreasure(card);
      }
    },
    [
      gameState,
      selectedCardIndices,
      toggleCardSelection,
      addCardSelection,
      handlePlayAction,
      handlePlayTreasure,
    ],
  );

  const handleInPlayClick = useCallback(
    (card: CardName, mainPlayerId: string) => {
      if (
        !gameState ||
        gameState.activePlayer !== mainPlayerId ||
        gameState.phase !== "buy"
      ) {
        return;
      }

      handleUnplayTreasure(card);
    },
    [gameState, handleUnplayTreasure],
  );

  const handleConfirmDecision = useCallback(
    (data: ComplexDecisionData | null, mainPlayerId: string) => {
      if (!gameState) return;

      const result = data
        ? submitComplexDecision(data, submitDecision)
        : submitSimpleDecision(
            selectedCardIndices,
            mainPlayerId,
            gameState,
            submitDecision,
          );

      if (result.ok) {
        clearSelection();
        clearComplexDecision();
      }
    },
    [
      gameState,
      selectedCardIndices,
      clearSelection,
      clearComplexDecision,
      submitDecision,
    ],
  );

  const handleSkipDecision = useCallback(() => {
    const result = submitDecision({ selectedCards: [] });
    if (result.ok) {
      clearSelection();
    }
  }, [submitDecision, clearSelection]);

  return {
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
  };
}
