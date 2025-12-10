import type {
  CardName,
  PlayerState,
  Phase,
  TurnSubPhase,
  GameState,
} from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { ActionBar } from "./Board/ActionBar";
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
  // ActionBar props
  gameState?: GameState;
  actionBarHint?: string;
  hasTreasuresInHand?: boolean;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  onConfirmDecision?: (complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
  onSkipDecision?: () => void;
  complexDecisionData?: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  } | null;
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
  actionBarHint = "",
  hasTreasuresInHand = false,
  onPlayAllTreasures,
  onEndPhase,
  onConfirmDecision,
  onSkipDecision,
  complexDecisionData,
}: PlayerAreaProps) {
  const isInteractive = !!onCardClick; // Can interact if callbacks provided
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);

  // Check if any purchases have been made this turn (treasures become non-take-backable)
  const hasMadePurchases = turnHistory.some(
    action => action.type === "buy_card",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ActionBar always visible */}
      {gameState && (
        <ActionBar
          state={gameState}
          hint={actionBarHint}
          hasTreasuresInHand={hasTreasuresInHand}
          onPlayAllTreasures={onPlayAllTreasures}
          onEndPhase={onEndPhase}
          selectedCardIndices={selectedCardIndices}
          complexDecisionData={complexDecisionData}
          onConfirmDecision={onConfirmDecision}
          onSkipDecision={onSkipDecision}
          borderColor={borderColor}
          isActive={isActive}
        />
      )}

      <div
        style={{
          padding: "var(--space-1) var(--space-2)",
          borderLeft:
            isActive && gameState
              ? `2px solid ${borderColor}`
              : `1px solid ${borderColor}`,
          borderRight:
            isActive && gameState
              ? `2px solid ${borderColor}`
              : `1px solid ${borderColor}`,
          borderBottom:
            isActive && gameState
              ? `2px solid ${borderColor}`
              : `1px solid ${borderColor}`,
          borderTop: "none",
          background: backgroundColor,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        <PlayerLabelSection
          label={label}
          playerId={playerId}
          loading={loading}
          playerStrategy={playerStrategy}
          vpCount={vpCount}
        />

        {/* Render in-play at top for normal, at bottom for inverted */}
        {!inverted && (
          <InPlaySection
            inPlay={player.inPlay}
            loading={loading}
            hasMadePurchases={hasMadePurchases}
            onInPlayClick={onInPlayClick}
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "75% 24.5%",
            gap: "var(--space-2)",
            alignItems: "stretch",
          }}
        >
          {/* Hand - show cards if showCards is true, otherwise show count */}
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

          {/* Deck & Discard box */}
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

        {/* Render in-play at bottom for inverted */}
        {inverted && (
          <div style={{ marginBlockStart: "var(--space-2)" }}>
            <InPlaySection
              inPlay={player.inPlay}
              loading={loading}
              hasMadePurchases={hasMadePurchases}
              onInPlayClick={onInPlayClick}
            />
          </div>
        )}

        {/* CSS Animations */}
        {loading && (
          <style>{`
          @keyframes subtlePulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.2; }
          }
        `}</style>
        )}
      </div>
    </div>
  );
}
