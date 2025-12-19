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
  vpCount?: number;
  isActive: boolean;
  showCards: boolean; // If false, show card counts instead of actual cards
  selectedCardIndices: number[];
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName, index: number) => void;
  inverted?: boolean; // If true, in-play appears at bottom (for top player)
  pendingChoice?: Extract<PendingChoice, { choiceType: "decision" }> | null;
  phase: Phase;
  actions?: number;
  loading?: boolean;
  playerId?: PlayerId;
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
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId: PlayerId | undefined;
  phase: Phase;
  actions: number | undefined;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
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
        loading={loading ?? false}
        selectedCardIndices={selectedCardIndices}
        {...(pendingChoice !== undefined && { pendingChoice })}
        isInteractive={isInteractive}
        isActive={isActive}
        {...(playerId !== undefined && { playerId })}
        phase={phase}
        {...(actions !== undefined && { actions })}
        {...(onCardClick !== undefined && { onCardClick })}
        {...(inverted !== undefined && { inverted })}
      />

      {showCards && (
        <DeckDiscardSection
          deck={player.deck}
          discard={player.discard}
          loading={loading ?? false}
          deckTopRevealed={player.deckTopRevealed ?? false}
          {...(pendingChoice !== undefined && { pendingChoice })}
          isInteractive={isInteractive}
          {...(onCardClick !== undefined && { onCardClick })}
          {...(inverted !== undefined && { inverted })}
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
  pendingChoice,
  playerId,
  phase,
  actions,
  loading = false,
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
            {...(loading !== undefined && { loading })}
            selectedCardIndices={selectedCardIndices}
            {...(pendingChoice !== undefined && { pendingChoice })}
            isInteractive={isInteractive}
            isActive={isActive}
            {...(playerId !== undefined && { playerId })}
            phase={phase}
            {...(actions !== undefined && { actions })}
            {...(onCardClick !== undefined && { onCardClick })}
            {...(inverted !== undefined && { inverted })}
          />

          <InPlaySection
            inPlay={player.inPlay}
            loading={loading}
            hasMadePurchases={hasMadePurchases}
            {...(onInPlayClick !== undefined && { onInPlayClick })}
            {...(inverted !== undefined && { inverted })}
          />

          <PlayerLabelSection
            label={label}
            {...(playerId !== undefined && { playerId })}
            loading={loading}
            {...(playerStrategy !== undefined && { playerStrategy })}
            {...(vpCount !== undefined && { vpCount })}
            {...(gameState?.phase !== undefined && { phase: gameState.phase })}
            {...(gameState?.actions !== undefined && {
              actions: gameState.actions,
            })}
            {...(gameState?.buys !== undefined && { buys: gameState.buys })}
            {...(gameState?.coins !== undefined && { coins: gameState.coins })}
            {...(isActive !== undefined && { isActive })}
          />
        </>
      ) : (
        <>
          <PlayerLabelSection
            label={label}
            {...(playerId !== undefined && { playerId })}
            loading={loading}
            {...(playerStrategy !== undefined && { playerStrategy })}
            {...(vpCount !== undefined && { vpCount })}
            {...(gameState?.phase !== undefined && { phase: gameState.phase })}
            {...(gameState?.actions !== undefined && {
              actions: gameState.actions,
            })}
            {...(gameState?.buys !== undefined && { buys: gameState.buys })}
            {...(gameState?.coins !== undefined && { coins: gameState.coins })}
            {...(isActive !== undefined && { isActive })}
          />

          <InPlaySection
            inPlay={player.inPlay}
            loading={loading}
            hasMadePurchases={hasMadePurchases}
            {...(onInPlayClick !== undefined && { onInPlayClick })}
          />

          <HandAndDeckGrid
            player={player}
            showCards={showCards}
            {...(loading !== undefined && { loading })}
            selectedCardIndices={selectedCardIndices}
            {...(pendingChoice !== undefined && { pendingChoice })}
            isInteractive={isInteractive}
            isActive={isActive}
            {...(playerId !== undefined && { playerId })}
            phase={phase}
            {...(actions !== undefined && { actions })}
            {...(onCardClick !== undefined && { onCardClick })}
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
    <PlayerAreaContent
      player={player}
      label={label}
      {...(vpCount !== undefined && { vpCount })}
      {...(isActive !== undefined && { isActive })}
      showCards={showCards}
      selectedCardIndices={selectedCardIndices}
      {...(onCardClick !== undefined && { onCardClick })}
      {...(onInPlayClick !== undefined && { onInPlayClick })}
      {...(inverted !== undefined && { inverted })}
      {...(pendingChoice !== undefined && { pendingChoice })}
      {...(playerId !== undefined && { playerId })}
      phase={phase}
      subPhase={subPhase}
      {...(actions !== undefined && { actions })}
      {...(loading !== undefined && { loading })}
      hasMadePurchases={hasMadePurchases}
      {...(playerStrategy !== undefined && { playerStrategy })}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      isInteractive={isInteractive}
      {...(gameState !== undefined && { gameState })}
    />
  );
}
