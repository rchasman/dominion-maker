import { PlayerArea } from "../PlayerArea";
import { CardDecisionModal } from "../CardDecisionModal";
import { formatPlayerName } from "../../lib/board-utils";
import { useGame } from "../../context/hooks";
import type { GameState, CardName } from "../../types/game-state";
import type { PlayerId } from "../../events/types";
import type { ComplexDecisionData } from "./hooks";
import type { PlayerStrategyData } from "../../types/player-strategy";

interface MainPlayerAreaProps {
  mainPlayer: GameState["players"][PlayerId];
  mainPlayerId: PlayerId;
  mainPlayerVP: number;
  isMainPlayerTurn: boolean;
  isMainPlayerAI: boolean;
  selectedCardIndices: number[];
  isPreviewMode: boolean;
  displayState: GameState;
  playerStrategy: PlayerStrategyData[number] | undefined;
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName) => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
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
  playerStrategy,
  onCardClick,
  onInPlayClick,
  onComplexDecisionChange,
}: MainPlayerAreaProps) {
  const { players } = useGame();

  // Try to get name from players list (multiplayer) or playerInfo (single-player/server)
  const playerName = players?.find(p => p.playerId === mainPlayerId)?.name;
  const displayName = playerName
    ? isMainPlayerAI
      ? `${playerName} (AI)`
      : playerName
    : formatPlayerName(mainPlayerId, isMainPlayerAI, {
        gameState: displayState,
      });

  return (
    <div style={{ position: "relative" }}>
      <PlayerArea
        player={mainPlayer}
        label={displayName}
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
      />

      {displayState.pendingDecision &&
        displayState.pendingDecision.actions &&
        displayState.pendingDecision.player === mainPlayerId &&
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
