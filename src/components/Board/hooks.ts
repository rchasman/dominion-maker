import {
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useGame } from "../../context/hooks";
import type { CardName, GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { CommandResult } from "../../commands/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import type { DecisionChoice } from "../../events/types";
import { uiLogger } from "../../lib/logger";

interface TypedGameContext {
  gameState: GameState | null;
  events: GameEvent[];
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  unplayTreasure: (card: CardName) => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  playAllTreasures: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  startGame: () => void;
  isProcessing: boolean;
  modelSettings: ModelSettings;
  setModelSettings: (settings: ModelSettings) => void;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
  playerStrategies: Record<
    string,
    {
      gameplan: string;
      read: string;
      lines: string;
    }
  >;
}

export function useTypedGame(): TypedGameContext {
  const context = useGame();

  return {
    gameState: context.gameState,
    events: context.events,
    playAction: context.playAction,
    playTreasure: context.playTreasure,
    unplayTreasure: context.unplayTreasure,
    buyCard: context.buyCard,
    endPhase: context.endPhase,
    playAllTreasures: context.playAllTreasures,
    submitDecision: context.submitDecision,
    hasPlayableActions: context.hasPlayableActions,
    hasTreasuresInHand: context.hasTreasuresInHand,
    gameMode: context.gameMode,
    setGameMode: context.setGameMode,
    startGame: context.startGame,
    isProcessing: context.isProcessing,
    modelSettings: context.modelSettings,
    setModelSettings: context.setModelSettings,
    requestUndo: context.requestUndo,
    getStateAtEvent: context.getStateAtEvent,
    playerStrategies: context.playerStrategies,
  };
}

interface CardSelectionHook {
  selectedCardIndices: number[];
  toggleCardSelection: (index: number) => void;
  addCardSelection: (index: number) => void;
  clearSelection: () => void;
  setSelectedCardIndices: Dispatch<SetStateAction<number[]>>;
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
  enterPreview: (eventId: string) => void;
  exitPreview: () => void;
  isPreviewMode: boolean;
}

export function usePreviewMode(): PreviewModeHook {
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);

  const enterPreview = useCallback((eventId: string) => {
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
  const { playAction, playTreasure, unplayTreasure } = useTypedGame();

  const handlePlayAction = useCallback(
    (card: CardName) => {
      const result = playAction(card);
      if (!result.ok) {
        uiLogger.error("Failed to play action:", result.error);
      }
      return result;
    },
    [playAction],
  );

  const handlePlayTreasure = useCallback(
    (card: CardName) => {
      const result = playTreasure(card);
      if (!result.ok) {
        uiLogger.error("Failed to play treasure:", result.error);
      }
      return result;
    },
    [playTreasure],
  );

  const handleUnplayTreasure = useCallback(
    (card: CardName) => {
      const result = unplayTreasure(card);
      if (!result.ok) {
        uiLogger.error("Failed to unplay treasure:", result.error);
      }
      return result;
    },
    [unplayTreasure],
  );

  return {
    handlePlayAction,
    handlePlayTreasure,
    handleUnplayTreasure,
  };
}
