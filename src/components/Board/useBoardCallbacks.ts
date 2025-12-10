import type { CardName } from "../../types/game-state";
import type { ComplexDecisionData } from "./hooks";

interface BoardCallbacksParams {
  isPreviewMode: boolean;
  isMainPlayerTurn: boolean;
  mainPlayerId: string;
  phase: "action" | "buy" | "cleanup";
  handleCardClick: (
    card: CardName,
    index: number,
    mainPlayerId: string,
  ) => void;
  handleInPlayClick: (card: CardName, mainPlayerId: string) => void;
  handleConfirmDecision: (
    data: ComplexDecisionData | null,
    mainPlayerId: string,
  ) => void;
  handleSkipDecision: () => void;
  playAllTreasures: () => void;
  endPhase: () => void;
}

interface BoardCallbacks {
  onCardClick: ((card: CardName, index: number) => void) | undefined;
  onInPlayClick: ((card: CardName) => void) | undefined;
  onPlayAllTreasures: (() => void) | undefined;
  onEndPhase: (() => void) | undefined;
  onConfirmDecision: ((data: ComplexDecisionData | null) => void) | undefined;
  onSkipDecision: (() => void) | undefined;
}

// Not a hook - pure function that creates callbacks
export function createBoardCallbacks(
  params: BoardCallbacksParams,
): BoardCallbacks {
  const {
    isPreviewMode,
    isMainPlayerTurn,
    mainPlayerId,
    phase,
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
    playAllTreasures,
    endPhase,
  } = params;

  const onCardClick = (card: CardName, index: number) => {
    if (!isPreviewMode) {
      handleCardClick(card, index, mainPlayerId);
    }
  };

  const onInPlayClick = (card: CardName) => {
    if (!isPreviewMode && phase === "buy") {
      handleInPlayClick(card, mainPlayerId);
    }
  };

  const onPlayAllTreasures = () => {
    if (isMainPlayerTurn && !isPreviewMode) {
      playAllTreasures();
    }
  };

  const onEndPhase = () => {
    if (isMainPlayerTurn && !isPreviewMode) {
      endPhase();
    }
  };

  const onConfirmDecision = (data: ComplexDecisionData | null) => {
    if (isMainPlayerTurn && !isPreviewMode) {
      handleConfirmDecision(data, mainPlayerId);
    }
  };

  const onSkipDecision = () => {
    if (isMainPlayerTurn && !isPreviewMode) {
      handleSkipDecision();
    }
  };

  return {
    onCardClick: isPreviewMode ? undefined : onCardClick,
    onInPlayClick:
      !isPreviewMode && phase === "buy" ? onInPlayClick : undefined,
    onPlayAllTreasures:
      isMainPlayerTurn && !isPreviewMode ? onPlayAllTreasures : undefined,
    onEndPhase: isMainPlayerTurn && !isPreviewMode ? onEndPhase : undefined,
    onConfirmDecision:
      isMainPlayerTurn && !isPreviewMode ? onConfirmDecision : undefined,
    onSkipDecision:
      isMainPlayerTurn && !isPreviewMode ? onSkipDecision : undefined,
  };
}
