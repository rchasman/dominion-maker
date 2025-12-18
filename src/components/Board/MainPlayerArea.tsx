import { PlayerArea } from "../PlayerArea";
import { CardDecisionModal } from "../CardDecisionModal";
import { ReactionModal } from "../ReactionModal";
import { formatPlayerName } from "../../lib/board-utils";
import { useGame } from "../../context/hooks";
import { getPlayerPerspective } from "../../lib/player-utils";
import type { GameState, CardName } from "../../types/game-state";
import type { PlayerId } from "../../events/types";
import type { ComplexDecisionData } from "./hooks";

interface MainPlayerAreaProps {
  localPlayer: GameState["players"][PlayerId];
  localPlayerVP: number;
  isLocalPlayerTurn: boolean;
  isLocalPlayerAI: boolean;
  selectedCardIndices: number[];
  isPreviewMode: boolean;
  displayState: GameState;
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName) => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
  onRevealReaction?: (card: CardName) => void;
  onDeclineReaction?: () => void;
}

export function MainPlayerArea({
  mainPlayer,
  localPlayerVP,
  isLocalPlayerTurn,
  isLocalPlayerAI,
  selectedCardIndices,
  isPreviewMode,
  displayState,
  onCardClick,
  onInPlayClick,
  onComplexDecisionChange,
  onRevealReaction,
  onDeclineReaction,
}: MainPlayerAreaProps) {
  const {
    players,
    gameMode,
    localPlayerId: contextLocalPlayerId,
    playerStrategies,
  } = useGame();
  const { localPlayerId } = getPlayerPerspective(
    displayState,
    gameMode,
    contextLocalPlayerId,
  );
  const playerStrategy = playerStrategies[localPlayerId];

  // Try to get name from players list (multiplayer) or playerInfo (single-player/server)
  const playerName = players?.find(p => p.playerId === localPlayerId)?.name;
  const displayName = playerName
    ? isLocalPlayerAI
      ? `${playerName} (AI)`
      : playerName
    : formatPlayerName(localPlayerId, isLocalPlayerAI, {
        gameState: displayState,
      });

  return (
    <div style={{ position: "relative" }}>
      <PlayerArea
        player={mainPlayer}
        label={displayName}
        vpCount={localPlayerVP}
        isActive={isLocalPlayerTurn}
        showCards={true}
        selectedCardIndices={isPreviewMode ? [] : selectedCardIndices}
        onCardClick={onCardClick}
        onInPlayClick={onInPlayClick}
        pendingChoice={displayState.pendingChoice}
        phase={displayState.phase}
        actions={displayState.actions}
        playerId={localPlayerId}
        turnHistory={displayState.turnHistory}
        playerStrategy={playerStrategy}
        gameState={displayState}
      />

      {displayState.pendingChoice &&
        displayState.pendingChoice.actions &&
        displayState.pendingChoice.player === localPlayerId &&
        !isPreviewMode && (
          <CardDecisionModal
            cards={displayState.pendingChoice.cardOptions}
            actions={displayState.pendingChoice.actions}
            requiresOrdering={displayState.pendingChoice.requiresOrdering}
            onDataChange={onComplexDecisionChange}
          />
        )}

      {displayState.pendingChoice &&
        displayState.pendingChoice.player === localPlayerId &&
        !isPreviewMode && (
          <ReactionModal
            reactions={displayState.pendingChoice.availableReactions}
            attackCard={displayState.pendingChoice.attackCard}
            attacker={displayState.pendingChoice.attacker}
            onReveal={onRevealReaction || (() => {})}
            onDecline={onDeclineReaction || (() => {})}
          />
        )}
    </div>
  );
}
