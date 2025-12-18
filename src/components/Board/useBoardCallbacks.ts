import type { CardName } from "../../types/game-state";
import type { ComplexDecisionData } from "./hooks";

interface BoardCallbacksParams {
  isPreviewMode: boolean;
  isLocalPlayerTurn: boolean;
  localPlayerId: string;
  phase: "action" | "buy" | "cleanup";
  handleCardClick: (
    card: CardName,
    index: number,
    localPlayerId: string,
  ) => void;
  handleInPlayClick: (card: CardName, localPlayerId: string) => void;
  handleConfirmDecision: (
    data: ComplexDecisionData | null,
    localPlayerId: string,
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
    isLocalPlayerTurn,
    localPlayerId,
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
      handleCardClick(card, index, localPlayerId);
    }
  };

  const onInPlayClick = (card: CardName) => {
    if (!isPreviewMode && phase === "buy") {
      handleInPlayClick(card, localPlayerId);
    }
  };

  const onPlayAllTreasures = () => {
    if (isLocalPlayerTurn && !isPreviewMode) {
      playAllTreasures();
    }
  };

  const onEndPhase = () => {
    if (isLocalPlayerTurn && !isPreviewMode) {
      endPhase();
    }
  };

  const onConfirmDecision = (data: ComplexDecisionData | null) => {
    if (isLocalPlayerTurn && !isPreviewMode) {
      handleConfirmDecision(data, localPlayerId);
    }
  };

  const onSkipDecision = () => {
    if (isLocalPlayerTurn && !isPreviewMode) {
      handleSkipDecision();
    }
  };

  return {
    onCardClick: isPreviewMode ? undefined : onCardClick,
    onInPlayClick:
      !isPreviewMode && phase === "buy" ? onInPlayClick : undefined,
    onPlayAllTreasures:
      isLocalPlayerTurn && !isPreviewMode ? onPlayAllTreasures : undefined,
    onEndPhase: isLocalPlayerTurn && !isPreviewMode ? onEndPhase : undefined,
    onConfirmDecision:
      isLocalPlayerTurn && !isPreviewMode ? onConfirmDecision : undefined,
    onSkipDecision:
      isLocalPlayerTurn && !isPreviewMode ? onSkipDecision : undefined,
  };
}
