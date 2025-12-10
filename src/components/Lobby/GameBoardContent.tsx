import { GameSidebar } from "../Board/GameSidebar";
import { EventDevtools } from "../EventDevtools";
import { GameOverModal } from "./GameOverModal";
import { GameBoardMainArea } from "./GameBoardMainArea";
import type { GameState, CardName, Player } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { PlayerInfo } from "../../multiplayer/p2p-room";

interface GameBoardContentProps {
  displayState: GameState;
  events: GameEvent[];
  isMyTurn: boolean;
  myPlayer: Player | null;
  myVP: number;
  canBuy: boolean;
  hintText: string;
  isBuyPhase: boolean;
  hasTreasuresInHand: boolean;
  selectedCardIndices: number[];
  validPreviewEventId: string | null;
  showDevtools: boolean;
  players: PlayerInfo[];
  myGamePlayerId: Player | null;
  onCardClick: (card: CardName, index: number) => void;
  onBuyCard: (card: CardName) => void;
  onEndPhase: () => void;
  onPlayAllTreasures: () => void;
  onSubmitDecision: () => void;
  onSkipDecision: () => void;
  onEndGame: () => void;
  onBackToHome: () => void;
  onRequestUndo: (eventId: string) => void;
  onToggleDevtools: () => void;
  onScrubEvent: (eventId: string) => void;
  leaveRoom: () => void;
}

export function GameBoardContent(props: GameBoardContentProps) {
  return (
    <div style={styles.container}>
      <GameBoardMainArea
        displayState={props.displayState}
        isMyTurn={props.isMyTurn}
        myPlayer={props.myPlayer}
        myVP={props.myVP}
        canBuy={props.canBuy}
        hintText={props.hintText}
        isBuyPhase={props.isBuyPhase}
        hasTreasuresInHand={props.hasTreasuresInHand}
        selectedCardIndices={props.selectedCardIndices}
        validPreviewEventId={props.validPreviewEventId}
        onCardClick={props.onCardClick}
        onBuyCard={props.onBuyCard}
        onEndPhase={props.onEndPhase}
        onPlayAllTreasures={props.onPlayAllTreasures}
        onSubmitDecision={props.onSubmitDecision}
        onSkipDecision={props.onSkipDecision}
      />

      <GameSidebar
        state={props.displayState}
        events={props.events}
        isProcessing={false}
        gameMode="multiplayer"
        localPlayer={props.myGamePlayerId || undefined}
        onEndGame={props.onEndGame}
        onBackToHome={props.onBackToHome}
        onRequestUndo={props.onRequestUndo}
      />

      {props.displayState.gameOver && (
        <GameOverModal
          displayState={props.displayState}
          players={props.players}
          onBackToHome={props.onBackToHome}
          leaveRoom={props.leaveRoom}
        />
      )}

      <EventDevtools
        events={props.events}
        isOpen={props.showDevtools}
        onToggle={props.onToggleDevtools}
        onBranchFrom={props.onRequestUndo}
        onScrub={props.onScrubEvent}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    height: "100dvh",
    overflow: "hidden",
    background: "var(--color-bg-primary)",
  },
};
