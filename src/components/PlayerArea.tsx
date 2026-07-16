import type {
  CardName,
  PlayerState,
  Phase,
  GameState,
  PlayerId,
} from "../types/game-state";
import type { PendingChoice } from "../events/types";
import { getSubPhase } from "../lib/state-helpers";
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
  vpCount?: number | undefined;
  isActive: boolean;
  showCards: boolean; // If false, show card counts instead of actual cards
  selectedCardIndices: number[];
  onCardClick?: ((card: CardName, index: number) => void) | undefined;
  onInPlayClick?: ((card: CardName, index: number) => void) | undefined;
  inverted?: boolean; // If true, in-play appears at bottom (for top player)
  pendingChoice?:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  phase: Phase;
  actions?: number | undefined;
  loading?: boolean;
  playerId?: PlayerId | undefined;
  turnHistory?: Array<{ type: string; card?: CardName | null }>;
  playerStrategy?:
    | {
        gameplan: string;
        read: string;
        recommendation: string;
      }
    | undefined;
  gameState?: GameState | undefined;
}

function getBorderStyle(
  isActive: boolean,
  borderColor: string,
): React.CSSProperties {
  return {
    border: `1px solid ${borderColor}`,
    outline: isActive ? `1px solid ${borderColor}` : "none",
    outlineOffset: "-2px",
    boxShadow: isActive ? `0 0 var(--space-5) ${borderColor}66` : "none",
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
  loading = false,
  selectedCardIndices,
  pendingChoice,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
  inverted = false,
}: {
  player: PlayerState;
  showCards: boolean;
  loading?: boolean;
  selectedCardIndices: number[];
  pendingChoice?:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId?: PlayerId | undefined;
  phase: Phase;
  actions?: number | undefined;
  onCardClick?: ((card: CardName, index: number) => void) | undefined;
  inverted?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "3fr 1fr",
        gap: "var(--space-2)",
        alignItems: "stretch",
      }}
    >
      <HandSection
        hand={player.hand}
        showCards={showCards}
        loading={loading}
        selectedCardIndices={selectedCardIndices}
        pendingChoice={pendingChoice}
        isInteractive={isInteractive}
        isActive={isActive}
        playerId={playerId}
        phase={phase}
        actions={actions}
        onCardClick={onCardClick}
        inverted={inverted}
      />
      {showCards && (
        <DeckDiscardSection
          deck={player.deck}
          discard={player.discard}
          loading={loading}
          deckTopRevealed={player.deckTopRevealed ?? false}
          pendingChoice={pendingChoice}
          isInteractive={isInteractive}
          onCardClick={onCardClick}
          inverted={inverted}
        />
      )}
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
  inverted,
  pendingChoice,
  phase,
  actions,
  loading = false,
  playerId,
  turnHistory = [],
  playerStrategy,
  gameState,
}: PlayerAreaProps) {
  const isInteractive = !!onCardClick;
  const subPhase = gameState ? getSubPhase(gameState) : null;
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);
  const hasMadePurchases = turnHistory.some(
    action => action.type === "buy_card",
  );

  return (
    <div
      style={{
        padding: inverted
          ? "var(--space-1) var(--space-2) 0 var(--space-2)"
          : "0 var(--space-2) var(--space-1) var(--space-2)",
        ...getBorderStyle(isActive, borderColor),
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
            pendingChoice={pendingChoice}
            isInteractive={isInteractive}
            isActive={isActive}
            playerId={playerId}
            phase={phase}
            actions={actions}
            onCardClick={onCardClick}
            inverted={inverted}
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
            pendingChoice={pendingChoice}
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
