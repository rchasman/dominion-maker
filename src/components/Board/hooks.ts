import {
  useState,
  useCallback,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";
import { useBuyCardLogic } from "../../hooks/useBuyCardLogic";
import type { CardName } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";
import { isDecisionChoice } from "../../types/pending-choice";
import { uiLogger } from "../../lib/logger";
import {
  gameState$,
  playAction$,
  playTreasure$,
  unplayTreasure$,
  buyCard$,
  submitDecision$,
} from "../../context/game-signals";

const uninitializedCommand = (): CommandResult => ({
  ok: false,
  error: "Game not initialized",
});

interface CardSelectionHook {
  selectedCardIndices: number[];
  toggleCardSelection: (index: number) => void;
  addCardSelection: (index: number) => void;
  clearSelection: () => void;
  setSelectedCardIndices: Dispatch<StateUpdater<number[]>>;
}

export function useCardSelection(): CardSelectionHook {
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);

  const toggleCardSelection = useCallback((index: number) => {
    setSelectedCardIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
    );
  }, []);

  const addCardSelection = useCallback((index: number) => {
    setSelectedCardIndices(prev => [...prev, index]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardIndices([]);
  }, []);

  return {
    selectedCardIndices,
    toggleCardSelection,
    addCardSelection,
    clearSelection,
    setSelectedCardIndices,
  };
}

interface PreviewModeHook {
  previewEventId: string | null;
  enterPreview: (eventId: string | null) => void;
  exitPreview: () => void;
  isPreviewMode: boolean;
}

export function usePreviewMode(): PreviewModeHook {
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);

  const enterPreview = useCallback((eventId: string | null) => {
    setPreviewEventId(eventId);
  }, []);

  const exitPreview = useCallback(() => {
    setPreviewEventId(null);
  }, []);

  const isPreviewMode = previewEventId !== null;

  return {
    previewEventId,
    enterPreview,
    exitPreview,
    isPreviewMode,
  };
}

export interface ComplexDecisionData {
  cardActions: Record<number, string>;
  cardOrder?: number[];
}

interface ComplexDecisionHook {
  complexDecisionData: ComplexDecisionData | null;
  updateComplexDecision: (data: ComplexDecisionData) => void;
  clearComplexDecision: () => void;
}

export function useComplexDecision(): ComplexDecisionHook {
  const [complexDecisionData, setComplexDecisionData] =
    useState<ComplexDecisionData | null>(null);

  const updateComplexDecision = useCallback((data: ComplexDecisionData) => {
    setComplexDecisionData(data);
  }, []);

  const clearComplexDecision = useCallback(() => {
    setComplexDecisionData(null);
  }, []);

  return {
    complexDecisionData,
    updateComplexDecision,
    clearComplexDecision,
  };
}

interface CardActionsHook {
  handlePlayAction: (card: CardName) => CommandResult;
  handlePlayTreasure: (card: CardName) => CommandResult;
  handleUnplayTreasure: (card: CardName) => CommandResult;
}

export function useCardActions(): CardActionsHook {
  const handlePlayAction = useCallback((card: CardName) => {
    const fn = playAction$.value ?? uninitializedCommand;
    const result = fn(card);
    if (!result.ok) {
      uiLogger.error("Failed to play action:", result.error);
    }
    return result;
  }, []);

  const handlePlayTreasure = useCallback((card: CardName) => {
    const fn = playTreasure$.value ?? uninitializedCommand;
    const result = fn(card);
    if (!result.ok) {
      uiLogger.error("Failed to play treasure:", result.error);
    }
    return result;
  }, []);

  const handleUnplayTreasure = useCallback((card: CardName) => {
    const fn = unplayTreasure$.value ?? uninitializedCommand;
    const result = fn(card);
    if (!result.ok) {
      uiLogger.error("Failed to unplay treasure:", result.error);
    }
    return result;
  }, []);

  return {
    handlePlayAction,
    handlePlayTreasure,
    handleUnplayTreasure,
  };
}

/**
 * Hook that wraps buyCard to check for pending decisions from supply first.
 * Uses the shared useBuyCardLogic hook to ensure consistent behavior between
 * Board (single-player) and Lobby (multiplayer) modes.
 */
export function useBuyCardHandler(): (card: CardName) => CommandResult {
  const pendingChoice = gameState$.value?.pendingChoice;
  return useBuyCardLogic({
    buyCard: buyCard$.value ?? uninitializedCommand,
    submitDecision: submitDecision$.value ?? uninitializedCommand,
    pendingChoice: isDecisionChoice(pendingChoice) ? pendingChoice : null,
  });
}
