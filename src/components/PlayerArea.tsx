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

function prepareHandSectionProps({
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
  inverted,
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
  playerId?: PlayerId;
  phase: Phase;
  actions?: number;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}) {
  const baseProps = {
    hand: player.hand,
    showCards,
    loading: loading ?? false,
    selectedCardIndices,
    isInteractive,
    isActive,
    phase,
  };

  const optionalProps: Record<string, unknown> = {};
  if (pendingChoice !== undefined) optionalProps.pendingChoice = pendingChoice;
  if (playerId !== undefined) optionalProps.playerId = playerId;
  if (actions !== undefined) optionalProps.actions = actions;
  if (onCardClick !== undefined) optionalProps.onCardClick = onCardClick;
  if (inverted !== undefined) optionalProps.inverted = inverted;

  return { ...baseProps, ...optionalProps };
}

function prepareDeckDiscardProps({
  player,
  loading,
  pendingChoice,
  isInteractive,
  onCardClick,
  inverted,
}: {
  player: PlayerState;
  loading?: boolean;
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  isInteractive: boolean;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}) {
  const baseProps = {
    deck: player.deck,
    discard: player.discard,
    loading: loading ?? false,
    deckTopRevealed: player.deckTopRevealed ?? false,
    isInteractive,
  };

  const optionalProps: Record<string, unknown> = {};
  if (pendingChoice !== undefined) optionalProps.pendingChoice = pendingChoice;
  if (onCardClick !== undefined) optionalProps.onCardClick = onCardClick;
  if (inverted !== undefined) optionalProps.inverted = inverted;

  return { ...baseProps, ...optionalProps };
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
  const handProps = prepareHandSectionProps({
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
    inverted,
  });

  const deckDiscardProps = prepareDeckDiscardProps({
    player,
    loading,
    pendingChoice,
    isInteractive,
    onCardClick,
    inverted,
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "75% 24.5%",
        gap: "var(--space-2)",
        alignItems: "stretch",
      }}
    >
      <HandSection {...handProps} />
      {showCards && <DeckDiscardSection {...deckDiscardProps} />}
    </div>
  );
}

function preparePlayerLabelProps({
  label,
  playerId,
  loading,
  playerStrategy,
  vpCount,
  gameState,
  isActive,
}: {
  label: string;
  playerId?: PlayerId;
  loading: boolean;
  playerStrategy?: {
    gameplan: string;
    read: string;
    recommendation: string;
  };
  vpCount?: number;
  gameState?: GameState;
  isActive: boolean;
}) {
  const baseProps = { label, loading, isActive };
  const optionalProps: Record<string, unknown> = {};

  if (playerId !== undefined) optionalProps.playerId = playerId;
  if (playerStrategy !== undefined)
    optionalProps.playerStrategy = playerStrategy;
  if (vpCount !== undefined) optionalProps.vpCount = vpCount;
  if (gameState?.phase !== undefined) optionalProps.phase = gameState.phase;
  if (gameState?.actions !== undefined)
    optionalProps.actions = gameState.actions;
  if (gameState?.buys !== undefined) optionalProps.buys = gameState.buys;
  if (gameState?.coins !== undefined) optionalProps.coins = gameState.coins;

  return { ...baseProps, ...optionalProps };
}

function prepareInPlayProps({
  player,
  loading,
  hasMadePurchases,
  onInPlayClick,
  inverted,
}: {
  player: PlayerState;
  loading: boolean;
  hasMadePurchases: boolean;
  onInPlayClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}) {
  const baseProps = {
    inPlay: player.inPlay,
    loading,
    hasMadePurchases,
  };
  const optionalProps: Record<string, unknown> = {};

  if (onInPlayClick !== undefined) optionalProps.onInPlayClick = onInPlayClick;
  if (inverted !== undefined) optionalProps.inverted = inverted;

  return { ...baseProps, ...optionalProps };
}

function prepareHandDeckGridProps({
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
  inverted,
}: {
  player: PlayerState;
  showCards: boolean;
  loading: boolean;
  selectedCardIndices: number[];
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId?: PlayerId;
  phase: Phase;
  actions?: number;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}) {
  const baseProps = {
    player,
    showCards,
    loading,
    selectedCardIndices,
    isInteractive,
    isActive,
    phase,
  };
  const optionalProps: Record<string, unknown> = {};

  if (pendingChoice !== undefined) optionalProps.pendingChoice = pendingChoice;
  if (playerId !== undefined) optionalProps.playerId = playerId;
  if (actions !== undefined) optionalProps.actions = actions;
  if (onCardClick !== undefined) optionalProps.onCardClick = onCardClick;
  if (inverted !== undefined) optionalProps.inverted = inverted;

  return { ...baseProps, ...optionalProps };
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
  const playerLabelProps = preparePlayerLabelProps({
    label,
    playerId,
    loading,
    playerStrategy,
    vpCount,
    gameState,
    isActive,
  });

  const inPlayProps = prepareInPlayProps({
    player,
    loading,
    hasMadePurchases,
    onInPlayClick,
    inverted,
  });

  const handDeckGridProps = prepareHandDeckGridProps({
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
    inverted,
  });

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
          <HandAndDeckGrid {...handDeckGridProps} />
          <InPlaySection {...inPlayProps} />
          <PlayerLabelSection {...playerLabelProps} />
        </>
      ) : (
        <>
          <PlayerLabelSection {...playerLabelProps} />
          <InPlaySection {...{ ...inPlayProps, inverted: undefined }} />
          <HandAndDeckGrid {...{ ...handDeckGridProps, inverted: undefined }} />
        </>
      )}

      <LoadingAnimation show={loading} />
    </div>
  );
}

function preparePlayerAreaContentProps(props: PlayerAreaProps) {
  const {
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
    loading,
    playerId,
    turnHistory,
    playerStrategy,
    gameState,
  } = props;

  const isInteractive = !!onCardClick;
  const subPhase = gameState ? getSubPhase(gameState) : null;
  const borderColor = getPhaseBorderColor(isActive, phase, subPhase);
  const backgroundColor = getPhaseBackground(isActive, phase, subPhase);
  const hasMadePurchases = turnHistory.some(
    action => action.type === "buy_card",
  );

  const baseProps = {
    player,
    label,
    isActive,
    showCards,
    selectedCardIndices,
    phase,
    loading,
    hasMadePurchases,
    borderColor,
    backgroundColor,
    isInteractive,
  };

  const optionalProps: Record<string, unknown> = {};
  if (vpCount !== undefined) optionalProps.vpCount = vpCount;
  if (onCardClick !== undefined) optionalProps.onCardClick = onCardClick;
  if (onInPlayClick !== undefined) optionalProps.onInPlayClick = onInPlayClick;
  if (inverted !== undefined) optionalProps.inverted = inverted;
  if (pendingChoice !== undefined) optionalProps.pendingChoice = pendingChoice;
  if (playerId !== undefined) optionalProps.playerId = playerId;
  if (actions !== undefined) optionalProps.actions = actions;
  if (playerStrategy !== undefined)
    optionalProps.playerStrategy = playerStrategy;
  if (gameState !== undefined) optionalProps.gameState = gameState;

  return { ...baseProps, ...optionalProps };
}

export function PlayerArea(props: PlayerAreaProps) {
  const contentProps = preparePlayerAreaContentProps(props);
  return <PlayerAreaContent {...contentProps} />;
}
