/**
 * Game Room - Pre-game lobby and in-game wrapper
 *
 * Uses a single PartySocket connection via MultiplayerProvider.
 * Shows waiting room or game board based on game state.
 */
import { useMemo } from "preact/hooks";
import { usePartyGame } from "../../partykit/usePartyGame";
import type { BotConfig } from "../../partykit/protocol";
import { DEFAULT_LLM_SEAT } from "../../core/seats";
import { Board } from "../Board";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { DisconnectModal } from "./DisconnectModal";
import { BaseModal } from "../Modal/BaseModal";
import { useMultiplayerGameContext } from "../../context/use-multiplayer-game-context";
import { AnimationProvider } from "../../animation";

interface GameRoomProps {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator: boolean;
  onBack: () => void;
  onResign?: () => void;
}

export function GameRoom({
  roomId,
  playerName,
  clientId,
  isSpectator,
  onBack,
  onResign,
}: GameRoomProps) {
  // Single connection - used for both waiting room and game
  const game = usePartyGame({ roomId, playerName, clientId, isSpectator });

  // Sync multiplayer state into signals
  // usePartyGame has no processing concept; the context derives spinners from
  // isConnected, so a constant false preserves the previous (absent) value.
  useMultiplayerGameContext({
    game: { ...game, isProcessing: false },
    playerName,
    isSpectator,
  });

  // Handle resignation
  const handleResign = () => {
    if (!isSpectator && game.playerId) {
      game.resign();
    }
    if (onResign) {
      onResign();
    } else {
      onBack();
    }
  };

  // Get disconnected opponent (if any)
  const disconnectedOpponent = useMemo(() => {
    if (isSpectator || !game.playerId) return null;

    const opponent = Array.from(game.disconnectedPlayers.entries()).find(
      ([playerId]) => playerId !== game.playerId,
    );
    return opponent ? { playerId: opponent[0], playerName: opponent[1] } : null;
  }, [game.disconnectedPlayers, game.playerId, isSpectator]);

  // Show game board if game has started
  if (game.gameState) {
    // Wait for playerId to be set before rendering Board
    if (!isSpectator && !game.playerId) {
      return <BoardSkeleton />;
    }

    return (
      <AnimationProvider>
        <Board onBackToHome={handleResign} />
        {isSpectator && <SpectatorBadge />}
        {disconnectedOpponent && (
          <DisconnectModal
            playerName={disconnectedOpponent.playerName}
            onLeave={handleResign}
          />
        )}
        {game.gameEndReason && (
          <GameOverNotification
            message={game.gameEndReason}
            onClose={() => {
              localStorage.removeItem("dominion_active_game");
              onBack();
            }}
          />
        )}
      </AnimationProvider>
    );
  }

  const alone = game.isHost && game.players.length < 2;

  // Show loading modal over skeleton
  return (
    <div style={{ position: "relative" }}>
      <BoardSkeleton />
      <BaseModal>
        <div
          style={{
            fontSize: "1.25rem",
            color: "var(--color-gold)",
            textShadow: "var(--shadow-glow-gold)",
            letterSpacing: "0.1rem",
            textTransform: "uppercase",
            marginBottom: "var(--space-4)",
          }}
        >
          {isSpectator ? "Waiting for game..." : "Starting game..."}
        </div>
        {alone && (
          <AddAiOpponent
            onStart={controller =>
              game.startGame(undefined, [{ name: "AI Opponent", controller }])
            }
          />
        )}
        {game.error && (
          <div
            style={{
              padding: "var(--space-3)",
              background: "rgba(220, 38, 38, 0.2)",
              border: "1px solid rgba(220, 38, 38, 0.5)",
              borderRadius: "4px",
              color: "#fca5a5",
              fontSize: "0.75rem",
              marginBottom: "var(--space-4)",
            }}
          >
            {game.error}
          </div>
        )}
        <button
          onClick={handleResign}
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "0.75rem",
            background: "transparent",
            color: "var(--color-text-tertiary)",
            border: "1px solid var(--color-border-primary)",
            cursor: "pointer",
            fontFamily: "inherit",
            borderRadius: "4px",
          }}
        >
          Leave
        </button>
      </BaseModal>
    </div>
  );
}

function AddAiOpponent({
  onStart,
}: {
  onStart: (controller: BotConfig) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "var(--space-4)",
      }}
    >
      <button
        onClick={() => onStart(DEFAULT_LLM_SEAT)}
        style={{
          padding: "var(--space-2) var(--space-4)",
          fontSize: "0.75rem",
          fontWeight: 600,
          background: "var(--color-victory-dark)",
          color: "#fff",
          border: "1px solid var(--color-victory)",
          cursor: "pointer",
          fontFamily: "inherit",
          borderRadius: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
        }}
      >
        Add AI opponent and start
      </button>
    </div>
  );
}

function SpectatorBadge() {
  return (
    <div
      style={{
        position: "fixed",
        top: "var(--space-4)",
        right: "var(--space-4)",
        padding: "var(--space-2) var(--space-4)",
        background: "rgba(0, 0, 0, 0.8)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "4px",
        color: "var(--color-text-secondary)",
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        zIndex: 1000,
      }}
    >
      Spectating
    </div>
  );
}

interface GameOverNotificationProps {
  message: string;
  onClose: () => void;
}

function GameOverNotification({ message, onClose }: GameOverNotificationProps) {
  return (
    <BaseModal zIndex={2000}>
      <h2
        style={{
          margin: 0,
          marginBottom: "var(--space-4)",
          fontSize: "1.5rem",
          color: "var(--color-victory)",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
        }}
      >
        Victory!
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: "var(--space-6)",
          color: "var(--color-text-primary)",
          fontSize: "1rem",
        }}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        style={{
          padding: "var(--space-3) var(--space-6)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background:
            "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
          color: "#fff",
          border: "2px solid var(--color-victory)",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.1rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        Return to Lobby
      </button>
    </BaseModal>
  );
}
