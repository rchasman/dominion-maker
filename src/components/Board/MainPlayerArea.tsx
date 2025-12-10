import { PlayerArea } from "../PlayerArea";
import { CardDecisionModal } from "../CardDecisionModal";
import type { GameState, CardName, PlayerId } from "../../types/game-state";
import type { ComplexDecisionData } from "./hooks";

interface MainPlayerAreaProps {
  mainPlayer: GameState["players"][PlayerId];
  mainPlayerId: PlayerId;
  mainPlayerVP: number;
  isMainPlayerTurn: boolean;
  isMainPlayerAI: boolean;
  selectedCardIndices: number[];
  isPreviewMode: boolean;
  displayState: GameState;
  hint: string;
  hasTreasuresInHand: boolean;
  complexDecisionData: ComplexDecisionData | null;
  playerStrategy:
    | {
        gameplan: string;
        read: string;
        lines: string;
      }
    | undefined;
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName) => void;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  onConfirmDecision?: (data: ComplexDecisionData | null) => void;
  onSkipDecision?: () => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
  formatPlayerName: (playerId: PlayerId, isAI: boolean) => string;
}

export function MainPlayerArea({
  mainPlayer,
  mainPlayerId,
  mainPlayerVP,
  isMainPlayerTurn,
  isMainPlayerAI,
  selectedCardIndices,
  isPreviewMode,
  displayState,
  hint,
  hasTreasuresInHand,
  complexDecisionData,
  playerStrategy,
  onCardClick,
  onInPlayClick,
  onPlayAllTreasures,
  onEndPhase,
  onConfirmDecision,
  onSkipDecision,
  onComplexDecisionChange,
  formatPlayerName,
}: MainPlayerAreaProps) {
  return (
    <div style={{ position: "relative" }}>
      <PlayerArea
        player={mainPlayer}
        label={formatPlayerName(mainPlayerId, isMainPlayerAI)}
        vpCount={mainPlayerVP}
        isActive={isMainPlayerTurn}
        showCards={true}
        selectedCardIndices={isPreviewMode ? [] : selectedCardIndices}
        onCardClick={onCardClick}
        onInPlayClick={onInPlayClick}
        pendingDecision={displayState.pendingDecision}
        phase={displayState.phase}
        subPhase={displayState.subPhase}
        actions={displayState.actions}
        playerId={mainPlayerId}
        turnHistory={displayState.turnHistory}
        playerStrategy={playerStrategy}
        gameState={displayState}
        actionBarHint={hint}
        hasTreasuresInHand={hasTreasuresInHand}
        onPlayAllTreasures={onPlayAllTreasures}
        onEndPhase={onEndPhase}
        complexDecisionData={complexDecisionData}
        onConfirmDecision={onConfirmDecision}
        onSkipDecision={onSkipDecision}
      />

      {displayState.pendingDecision &&
        displayState.pendingDecision.actions &&
        !isPreviewMode && (
          <CardDecisionModal
            cards={displayState.pendingDecision.cardOptions}
            actions={displayState.pendingDecision.actions}
            requiresOrdering={displayState.pendingDecision.requiresOrdering}
            onDataChange={onComplexDecisionChange}
          />
        )}
    </div>
  );
}
