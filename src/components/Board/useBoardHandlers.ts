import { useCallback } from "preact/hooks";
import type { CardName, GameState } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";
import type { DecisionChoice } from "../../events/types";
import { shouldSelectCard } from "../../lib/decision-utils";
import { canPlayCard } from "../../lib/game-rules";
import type { ComplexDecisionData } from "./hooks";
import { useAnimationSafe } from "../../animation";

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
  revealReaction: (card: CardName) => CommandResult;
  declineReaction: () => CommandResult;
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
  localPlayerId: string,
  gameState: GameState,
  submitDecision: (choice: DecisionChoice) => CommandResult,
): CommandResult {
  const mainPlayer = gameState.players[localPlayerId];
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
    revealReaction,
    declineReaction,
  } = params;

  const animation = useAnimationSafe();

  const handleCardClick = useCallback(
    (card: CardName, index: number, localPlayerId: string) => {
      if (
        !gameState?.activePlayer ||
        gameState.activePlayer !== localPlayerId
      ) {
        return;
      }

      if (gameState.pendingChoice) {
        const selection = shouldSelectCard(
          index,
          selectedCardIndices,
          gameState.pendingChoice,
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
        gameState.activePlayer === localPlayerId,
      );

      // Capture card position before playing
      const cardElement = document.querySelector(
        `[data-card-id="hand-${index}-${card}"]`,
      );
      const fromRect = cardElement?.getBoundingClientRect();

      if (canPlay.canPlayAction) {
        handlePlayAction(card);
        // Queue animation after action
        if (animation && fromRect) {
          animation.queueAnimation({
            cardName: card,
            fromRect,
            toZone: "inPlay",
            duration: 250,
          });
        }
      } else if (canPlay.canPlayTreasure) {
        handlePlayTreasure(card);
        // Queue animation after treasure play
        if (animation && fromRect) {
          animation.queueAnimation({
            cardName: card,
            fromRect,
            toZone: "inPlay",
            duration: 200,
          });
        }
      }
    },
    [
      gameState,
      selectedCardIndices,
      toggleCardSelection,
      addCardSelection,
      handlePlayAction,
      handlePlayTreasure,
      animation,
    ],
  );

  const handleInPlayClick = useCallback(
    (card: CardName, localPlayerId: string) => {
      if (
        !gameState ||
        gameState.activePlayer !== localPlayerId ||
        gameState.phase !== "buy"
      ) {
        return;
      }

      // Find the card element in inPlay
      const cardElement = document.querySelector(
        `[data-card-id^="inPlay-"][data-card-id$="-${card}"]`,
      );
      const fromRect = cardElement?.getBoundingClientRect();

      handleUnplayTreasure(card);

      // Queue animation to hand
      if (animation && fromRect) {
        animation.queueAnimation({
          cardName: card,
          fromRect,
          toZone: "hand",
          duration: 200,
        });
      }
    },
    [gameState, handleUnplayTreasure, animation],
  );

  const handleConfirmDecision = useCallback(
    (data: ComplexDecisionData | null, localPlayerId: string) => {
      if (!gameState) return;

      const result = data
        ? submitComplexDecision(data, submitDecision)
        : submitSimpleDecision(
            selectedCardIndices,
            localPlayerId,
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

  const handleRevealReaction = useCallback(
    (card: CardName) => {
      const result = revealReaction(card);
      if (result.ok) {
        clearSelection();
      }
    },
    [revealReaction, clearSelection],
  );

  const handleDeclineReaction = useCallback(() => {
    const result = declineReaction();
    if (result.ok) {
      clearSelection();
    }
  }, [declineReaction, clearSelection]);

  return {
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
    handleRevealReaction,
    handleDeclineReaction,
  };
}
