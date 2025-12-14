import type {
  CardName,
  PlayerState,
  Phase,
  TurnSubPhase,
  GameState,
} from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { PlayerLabelSection } from "./PlayerArea/PlayerLabelSection";
import { InPlaySection } from "./PlayerArea/InPlaySection";
import { DeckDiscardSection } from "./PlayerArea/DeckDiscardSection";
import { HandSection } from "./PlayerArea/HandSection";
import {
  getPhaseBorderColor,
  getPhaseBackground,
} from "./PlayerArea/phase-styles";

interface PlayerAreaProps {
  player: PlayerState;
  label: string;
  vpCount?: number;
  isActive: boolean;
  showCards: boolean; // If false, show card counts instead of actual cards
  selectedCardIndices: number[];
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName, index: number) => void;
  inverted?: boolean; // If true, in-play appears at bottom (for top player)
  pendingDecision?: DecisionRequest | null;
  phase: Phase;
  subPhase: TurnSubPhase;
  actions?: number;
  loading?: boolean;
  playerId?: string;
  turnHistory?: Array<{ type: string; card?: CardName | null }>;
  playerStrategy?: {
    gameplan: string;
    read: string;
    recommendation: string;
  };
  gameState?: GameState;
}

function getBorderStyle(
  isActive: boolean,
  gameState: GameState | undefined,
  borderColor: string,
): React.CSSProperties {
  const borderWidth = isActive && gameState ? "2px" : "1px";
  const borderStyle = `${borderWidth} solid ${borderColor}`;

  return {
    border: borderStyle,
    boxShadow:
      isActive && gameState ? `0 0 var(--space-5) ${borderColor}66` : "none",
  };
}

function LoadingAnimation({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <style>{`
      @keyframes subtlePulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.2; }
      }
    `}</style>
  );
}

function HandAndDeckGrid({
  player,
  showCards,
  loading,
  selectedCardIndices,
  pendingDecision,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
}: {
  player: PlayerState;
  showCards: boolean;
  loading: boolean;
  selectedCardIndices: number[];
  pendingDecision: DecisionRequest | null | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId: string | undefined;
  phase: Phase;
  actions: number | undefined;
  onCardClick?: (card: CardName, index: number) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "75% 24.5%",
        gap: "var(--space-2)",
        alignItems: "stretch",
      }}
    >
      <HandSection
        hand={player.hand}
        showCards={showCards}
        loading={loading}
        selectedCardIndices={selectedCardIndices}
        pendingDecision={pendingDecision}
        isInteractive={isInteractive}
        isActive={isActive}
        playerId={playerId}
        phase={phase}
        actions={actions}
        onCardClick={onCardClick}
      />

      {showCards && (
        <DeckDiscardSection
          deck={player.deck}
          discard={player.discard}
          loading={loading}
          deckTopRevealed={player.deckTopRevealed}
          pendingDecision={pendingDecision}
          isInteractive={isInteractive}
          onCardClick={onCardClick}
        />
      )}
    </div>
  );
}

function PlayerAreaContent({
  player,
  label,
  vpCount,
  isActive,
  showCards,
  selectedCardIndices,
  onCardClick,
  onInPlayClick,
  inverted,
  pendingDecision,
  playerId,
  phase,
  actions,
  loading,
  hasMadePurchases,
  playerStrategy,
  borderColor,
  backgroundColor,
  isInteractive,
  gameState,
}: PlayerAreaProps & {
  hasMadePurchases: boolean;
  borderColor: string;
  backgroundColor: string;
  isInteractive: boolean;
}): React.ReactNode {
  return (
    <div
      style={{
        padding: inverted
          ? "var(--space-1) var(--space-2) 0 var(--space-2)"
          : "0 var(--space-2) var(--space-1) var(--space-2)",
        ...getBorderStyle(isActive, undefined, borderColor),
        background: backgroundColor,
        overflow: "auto",
        minHeight: 0,
      }}
    >
      {inverted ? (
        <>
          <HandAndDeckGrid
            player={player}
            showCards={showCards}
            loading={loading}
            selectedCardIndices={selectedCardIndices}
            pendingDecision={pendingDecision}
            isInteractive={isInteractive}
            isActive={isActive}
            playerId={playerId}
            phase={phase}
            actions={actions}
            onCardClick={onCardClick}
          />

          <InPlaySection
            inPlay={player.inPlay}
            loading={loading}
            hasMadePurchases={hasMadePurchases}
            onInPlayClick={onInPlayClick}
            inverted={inverted}
          />

          <PlayerLabelSection
            label={label}
            playerId={playerId}
            loading={loading}
            playerStrategy={playerStrategy}
            vpCount={vpCount}
            phase={gameState?.phase}
            actions={gameState?.actions}
            buys={gameState?.buys}
            coins={gameState?.coins}
            isActive={isActive}
          />
        </>
      ) : (
        <>
          <PlayerLabelSection
            label={label}
            playerId={playerId}
            loading={loading}
            playerStrategy={playerStrategy}
            vpCount={vpCount}
            phase={gameState?.phase}
            actions={gameState?.actions}
            buys={gameState?.buys}
            coins={gameState?.coins}
            isActive={isActive}
          />

          <InPlaySection
            inPlay={player.inPlay}
            loading={loading}
            hasMadePurchases={hasMadePurchases}
            onInPlayClick={onInPlayClick}
          />

          <HandAndDeckGrid
            player={player}
            showCards={showCards}
            loading={loading}
            selectedCardIndices={selectedCardIndices}
            pendingDecision={pendingDecision}
            isInteractive={isInteractive}
            isActive={isActive}
            playerId={playerId}
            phase={phase}
            actions={actions}
            onCardClick={onCardClick}
          />
        </>
      )}

      <LoadingAnimation show={loading} />
    </div>
  );
}

export function PlayerArea({
  player,
  label,
  vpCount,
  isActive,
  showCards,
  selectedCardIndices,
  onCardClick,
  onInPlayClick,
  inverted = false,
  pendingDecision,
  playerId,
  phase,
  subPhase,
  actions,
  loading = false,
  turnHistory = [],
  playerStrategy,
  gameState,
}: PlayerAreaProps) {
  const isInteractive = !!onCardClick;
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);
  const hasMadePurchases = turnHistory.some(
    action => action.type === "buy_card",
  );

  return (
    <PlayerAreaContent
      player={player}
      label={label}
      vpCount={vpCount}
      isActive={isActive}
      showCards={showCards}
      selectedCardIndices={selectedCardIndices}
      onCardClick={onCardClick}
      onInPlayClick={onInPlayClick}
      inverted={inverted}
      pendingDecision={pendingDecision}
      playerId={playerId}
      phase={phase}
      subPhase={subPhase}
      actions={actions}
      loading={loading}
      hasMadePurchases={hasMadePurchases}
      playerStrategy={playerStrategy}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      isInteractive={isInteractive}
      gameState={gameState}
    />
  );
}
