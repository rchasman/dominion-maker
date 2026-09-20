import { PlayerArea } from "../PlayerArea";
import { CardDecisionModal } from "../CardDecisionModal";
import { CardChoicePanel } from "../CardChoicePanel";
import { ReactionModal } from "../ReactionModal";
import { formatPlayerName } from "../../lib/board-utils";
import { getPlayerPerspective } from "../../lib/player-utils";
import {
  players$,
  seats$,
  localPlayerId$ as localPlayerId$$,
  playerStrategies$,
} from "../../context/game-signals";
import type { ComponentChildren } from "preact";
import type { GameState, CardName } from "../../types/game-state";
import type { PlayerId } from "../../events/types";
import type { ComplexDecisionData } from "./hooks";
import { isDecisionChoice, isReactionChoice } from "../../types/pending-choice";
import { selectsFromHand } from "../../lib/decision-utils";
import { run } from "../../lib/run";

interface MainPlayerAreaProps {
  localPlayer: GameState["players"][PlayerId];
  localPlayerVP: number;
  isLocalPlayerTurn: boolean;
  isLocalPlayerAI: boolean;
  headerControl?: ComponentChildren;
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
  localPlayer,
  localPlayerVP,
  isLocalPlayerTurn,
  isLocalPlayerAI,
  headerControl,
  selectedCardIndices,
  isPreviewMode,
  displayState,
  onCardClick,
  onInPlayClick,
  onComplexDecisionChange,
  onRevealReaction,
  onDeclineReaction,
}: MainPlayerAreaProps) {
  const players = players$.value;
  const contextLocalPlayerId = localPlayerId$$.value;
  const playerStrategies = playerStrategies$.value;
  const { localPlayerId } = getPlayerPerspective(
    displayState,
    seats$.value,
    contextLocalPlayerId,
  );
  const playerStrategy = playerStrategies[localPlayerId];

  // Try to get name from players list (multiplayer) or playerInfo (single-player/server)
  const playerName = players?.find(p => p.id === localPlayerId)?.name;
  const displayName = run(() => {
    if (playerName) {
      return isLocalPlayerAI ? `${playerName} (AI)` : playerName;
    }
    return formatPlayerName(localPlayerId, isLocalPlayerAI, {
      gameState: displayState,
    });
  });

  return (
    <div style={{ position: "relative" }}>
      <PlayerArea
        player={localPlayer}
        label={displayName}
        {...(headerControl !== undefined && { headerControl })}
        vpCount={localPlayerVP}
        isActive={isLocalPlayerTurn}
        showCards={true}
        selectedCardIndices={isPreviewMode ? [] : selectedCardIndices}
        onCardClick={onCardClick}
        onInPlayClick={onInPlayClick}
        pendingChoice={
          isDecisionChoice(displayState.pendingChoice)
            ? displayState.pendingChoice
            : null
        }
        phase={displayState.phase}
        actions={displayState.actions}
        playerId={localPlayerId}
        turnHistory={displayState.turnHistory}
        playerStrategy={playerStrategy}
        gameState={displayState}
      />

      {isDecisionChoice(displayState.pendingChoice) &&
        displayState.pendingChoice.actions &&
        displayState.pendingChoice.playerId === localPlayerId &&
        !isPreviewMode && (
          <CardDecisionModal
            cards={displayState.pendingChoice.cardOptions}
            actions={displayState.pendingChoice.actions}
            {...(displayState.pendingChoice.requiresOrdering !== undefined && {
              requiresOrdering: displayState.pendingChoice.requiresOrdering,
            })}
            onDataChange={onComplexDecisionChange}
          />
        )}

      {isDecisionChoice(displayState.pendingChoice) &&
        !displayState.pendingChoice.actions &&
        !selectsFromHand(displayState.pendingChoice) &&
        displayState.pendingChoice.from !== "supply" &&
        displayState.pendingChoice.playerId === localPlayerId &&
        !isPreviewMode &&
        onCardClick && (
          <CardChoicePanel
            pendingChoice={displayState.pendingChoice}
            selectedCardIndices={selectedCardIndices}
            onCardClick={onCardClick}
          />
        )}

      {isReactionChoice(displayState.pendingChoice) &&
        displayState.pendingChoice.playerId === localPlayerId &&
        !isPreviewMode && (
          <ReactionModal
            reactions={displayState.pendingChoice.availableReactions}
            triggeringCard={displayState.pendingChoice.triggeringCard}
            triggeringPlayerId={displayState.pendingChoice.triggeringPlayerId}
            onReveal={onRevealReaction || (() => {})}
            onDecline={onDeclineReaction || (() => {})}
          />
        )}
    </div>
  );
}
