import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { TurnIndicator } from "./TurnIndicator";
import { ActionBar } from "./ActionBar";
import { DecisionPanel } from "./DecisionPanel";
import type { GameState, CardName, Player } from "../../types/game-state";
import type { PlayerInfo } from "../../multiplayer/p2p-room";

interface GameBoardMainAreaProps {
  displayState: GameState;
  isMyTurn: boolean;
  myPlayer: Player | null;
  myVP: number;
  canBuy: boolean;
  hintText: string;
  isBuyPhase: boolean;
  hasTreasuresInHand: boolean;
  selectedCardIndices: number[];
  validPreviewEventId: string | null;
  onCardClick: (card: CardName, index: number) => void;
  onBuyCard: (card: CardName) => void;
  onEndPhase: () => void;
  onPlayAllTreasures: () => void;
  onSubmitDecision: () => void;
  onSkipDecision: () => void;
}

const ZERO = 0;

function renderActionBar(params: {
  isMyTurn: boolean;
  validPreviewEventId: string | null;
  hintText: string;
  isBuyPhase: boolean;
  hasTreasuresInHand: boolean;
  phase: string;
  onPlayAllTreasures: () => void;
  onEndPhase: () => void;
}) {
  if (!params.isMyTurn || params.validPreviewEventId !== null) return null;

  return (
    <ActionBar
      hintText={params.hintText}
      isBuyPhase={params.isBuyPhase}
      hasTreasuresInHand={params.hasTreasuresInHand}
      phase={params.phase}
      onPlayAllTreasures={params.onPlayAllTreasures}
      onEndPhase={params.onEndPhase}
    />
  );
}

function renderDecisionPanel(params: {
  pendingDecision: GameState["pendingDecision"];
  myPlayer: Player | null;
  selectedCardIndices: number[];
  myPlayerHand: CardName[];
  onSubmitDecision: () => void;
  onSkipDecision: () => void;
}) {
  if (
    !params.pendingDecision ||
    params.pendingDecision.player !== params.myPlayer
  ) {
    return null;
  }

  return (
    <DecisionPanel
      pendingDecision={params.pendingDecision}
      selectedCardIndices={params.selectedCardIndices}
      myPlayerHand={params.myPlayerHand}
      onSubmitDecision={params.onSubmitDecision}
      onSkipDecision={params.onSkipDecision}
    />
  );
}

export function GameBoardMainArea(props: GameBoardMainAreaProps) {
  const myPlayerState = props.myPlayer
    ? props.displayState.players[props.myPlayer]
    : null;
  const playerInfo = props.displayState.playerInfo;

  return (
    <div style={styles.mainArea}>
      <TurnIndicator
        isMyTurn={props.isMyTurn}
        playerInfo={playerInfo as Record<string, PlayerInfo> | undefined}
        activePlayer={props.displayState.activePlayer}
        phase={props.displayState.phase}
      />

      <Supply
        state={props.displayState}
        onBuyCard={props.onBuyCard}
        canBuy={props.canBuy}
        availableCoins={props.displayState.coins}
        pendingDecision={props.displayState.pendingDecision}
      />

      {renderActionBar({
        isMyTurn: props.isMyTurn,
        validPreviewEventId: props.validPreviewEventId,
        hintText: props.hintText,
        isBuyPhase: props.isBuyPhase,
        hasTreasuresInHand: props.hasTreasuresInHand,
        phase: props.displayState.phase,
        onPlayAllTreasures: props.onPlayAllTreasures,
        onEndPhase: props.onEndPhase,
      })}

      {renderDecisionPanel({
        pendingDecision: props.displayState.pendingDecision,
        myPlayer: props.myPlayer,
        selectedCardIndices: props.selectedCardIndices,
        myPlayerHand: myPlayerState?.hand ?? [],
        onSubmitDecision: props.onSubmitDecision,
        onSkipDecision: props.onSkipDecision,
      })}

      <PlayerArea
        player={
          myPlayerState ?? {
            hand: [],
            deck: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
            deckTopRevealed: false,
          }
        }
        label="You"
        vpCount={myPlayerState ? props.myVP : ZERO}
        isActive={props.isMyTurn}
        isHuman={true}
        selectedCardIndices={props.selectedCardIndices}
        onCardClick={props.onCardClick}
        pendingDecision={props.displayState.pendingDecision}
        phase={props.displayState.phase}
        subPhase={props.displayState.subPhase}
        actions={props.displayState.actions}
        loading={!myPlayerState}
        playerId={props.myPlayer || undefined}
        turnHistory={props.displayState.turnHistory}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mainArea: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    padding: "var(--space-4)",
    overflow: "auto",
  },
};
