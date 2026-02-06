import { useState, useCallback, type StateUpdater } from "preact/hooks";
import { useBuyCardLogic } from "../../hooks/useBuyCardLogic";
import type { CardName, GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { CommandResult } from "../../commands/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/types";
import type { DecisionChoice } from "../../events/types";
import type { PlayerStrategyData } from "../../types/player-strategy";
import { uiLogger } from "../../lib/logger";
import {
  gameState$,
  events$,
  playAction$,
  playTreasure$,
  unplayTreasure$,
  buyCard$,
  endPhase$,
  playAllTreasures$,
  submitDecision$,
  revealReaction$,
  declineReaction$,
  hasPlayableActions$,
  hasTreasuresInHand$,
  gameMode$,
  setGameMode$,
  startGame$,
  isProcessing$,
  modelSettings$,
  setModelSettings$,
  requestUndo$,
  getStateAtEvent$,
  playerStrategies$,
  localPlayerId$,
  isSpectator$,
} from "../../context/game-signals";

const uninitializedCommand = (): CommandResult => ({
  ok: false,
  error: "Game not initialized",
});

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
  revealReaction: (card: CardName) => CommandResult;
  declineReaction: () => CommandResult;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  gameMode: GameMode;
  setGameMode?: (mode: GameMode) => void;
  startGame?: () => void;
  isProcessing: boolean;
  modelSettings: ModelSettings;
  setModelSettings?: (settings: Partial<ModelSettings>) => void;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
  playerStrategies: PlayerStrategyData;
  localPlayerId?: string | null;
  isSpectator?: boolean;
}

export function useTypedGame(): TypedGameContext {
  return {
    gameState: gameState$.value,
    events: events$.value,
    playAction: playAction$.value ?? uninitializedCommand,
    playTreasure: playTreasure$.value ?? uninitializedCommand,
    unplayTreasure: unplayTreasure$.value ?? uninitializedCommand,
    buyCard: buyCard$.value ?? uninitializedCommand,
    endPhase: endPhase$.value ?? uninitializedCommand,
    playAllTreasures: playAllTreasures$.value ?? uninitializedCommand,
    submitDecision: submitDecision$.value ?? uninitializedCommand,
    revealReaction: revealReaction$.value ?? uninitializedCommand,
    declineReaction: declineReaction$.value ?? uninitializedCommand,
    hasPlayableActions: hasPlayableActions$.value,
    hasTreasuresInHand: hasTreasuresInHand$.value,
    gameMode: gameMode$.value,
    setGameMode: setGameMode$.value ?? undefined,
    startGame: startGame$.value ?? undefined,
    isProcessing: isProcessing$.value,
    modelSettings: modelSettings$.value,
    setModelSettings: setModelSettings$.value ?? undefined,
    requestUndo: requestUndo$.value ?? (() => {}),
    getStateAtEvent:
      getStateAtEvent$.value ??
      (() => {
        throw new Error("getStateAtEvent not initialized");
      }),
    playerStrategies: playerStrategies$.value,
    localPlayerId: localPlayerId$.value,
    isSpectator: isSpectator$.value,
  };
}

interface CardSelectionHook {
  selectedCardIndices: number[];
  toggleCardSelection: (index: number) => void;
  addCardSelection: (index: number) => void;
  clearSelection: () => void;
  setSelectedCardIndices: StateUpdater<number[]>;
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
  return useBuyCardLogic({
    buyCard: buyCard$.value ?? uninitializedCommand,
    submitDecision: submitDecision$.value ?? uninitializedCommand,
    pendingChoice: gameState$.value?.pendingChoice,
  });
}
