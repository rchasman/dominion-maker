import { PlayerArea } from "../PlayerArea";
import { CardDecisionModal } from "../CardDecisionModal";
import { ReactionModal } from "../ReactionModal";
import { formatPlayerName } from "../../lib/board-utils";
import { useGame } from "../../context/hooks";
import type { GameState, CardName } from "../../types/game-state";
import type { PlayerId } from "../../events/types";
import type { ComplexDecisionData } from "./hooks";
import type { PlayerStrategyData } from "../../types/player-strategy";

interface MainPlayerAreaProps {
  localPlayer: GameState["players"][PlayerId];
  localPlayerId: PlayerId;
  localPlayerVP: number;
  isLocalPlayerTurn: boolean;
  isLocalPlayerAI: boolean;
  selectedCardIndices: number[];
  isPreviewMode: boolean;
  displayState: GameState;
  playerStrategy: PlayerStrategyData[number] | undefined;
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName) => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
  onRevealReaction?: (card: CardName) => void;
  onDeclineReaction?: () => void;
}

export function MainPlayerArea({
  mainPlayer,
  localPlayerId,
  localPlayerVP,
  isLocalPlayerTurn,
  isLocalPlayerAI,
  selectedCardIndices,
  isPreviewMode,
  displayState,
  playerStrategy,
  onCardClick,
  onInPlayClick,
  onComplexDecisionChange,
  onRevealReaction,
  onDeclineReaction,
}: MainPlayerAreaProps) {
  const { players } = useGame();

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
        pendingDecision={displayState.pendingDecision}
        phase={displayState.phase}
        actions={displayState.actions}
        playerId={localPlayerId}
        turnHistory={displayState.turnHistory}
        playerStrategy={playerStrategy}
        gameState={displayState}
      />

      {displayState.pendingDecision &&
        displayState.pendingDecision.actions &&
        displayState.pendingDecision.player === localPlayerId &&
        !isPreviewMode && (
          <CardDecisionModal
            cards={displayState.pendingDecision.cardOptions}
            actions={displayState.pendingDecision.actions}
            requiresOrdering={displayState.pendingDecision.requiresOrdering}
            onDataChange={onComplexDecisionChange}
          />
        )}

      {displayState.pendingReaction &&
        displayState.pendingReaction.defender === localPlayerId &&
        !isPreviewMode && (
          <ReactionModal
            reactions={displayState.pendingReaction.availableReactions}
            attackCard={displayState.pendingReaction.attackCard}
            attacker={displayState.pendingReaction.attacker}
            onReveal={onRevealReaction || (() => {})}
            onDecline={onDeclineReaction || (() => {})}
          />
        )}
    </div>
  );
}
