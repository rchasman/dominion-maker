/**
 * Game Room - Pre-game lobby and in-game wrapper
 *
 * Uses a single PartySocket connection via MultiplayerProvider.
 * Shows waiting room or game board based on game state.
 */
import { lazy, Suspense } from "preact/compat";
import { useMemo, useState, useEffect, useRef } from "preact/hooks";
import { GameContext, LLMLogsContext } from "../../context/GameContext";
import { usePartyGame } from "../../partykit/usePartyGame";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { DisconnectModal } from "./DisconnectModal";
import { BaseModal } from "../Modal/BaseModal";
import type { CardName } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";
import type { PlayerStrategyData } from "../../types/player-strategy";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "../../context/derived-state";
import { DEFAULT_MODEL_SETTINGS } from "../../agent/game-agent";
import { api } from "../../api/client";
import { MIN_TURN_FOR_STRATEGY } from "../../context/game-constants";
import type { GameMode } from "../../types/game-mode";

const Board = lazy(() => import("../Board").then(m => ({ default: m.Board })));

interface GameRoomProps {
  roomId: string;
  playerName: string;
  clientId: string;
  isSpectator: boolean;
  isSinglePlayer?: boolean;
  gameMode?: GameMode;
  onGameModeChange?: (mode: GameMode) => void;
  onBack: () => void;
  onResign?: () => void;
  onConnectionError?: () => void;
}

export function GameRoom({
  roomId,
  playerName,
  clientId,
  isSpectator,
  isSinglePlayer = false,
  gameMode = "engine",
  onGameModeChange,
  onBack,
  onResign,
  onConnectionError,
}: GameRoomProps) {
  // Single connection - used for both waiting room and game
  const game = usePartyGame({
    roomId,
    playerName,
    clientId,
    isSpectator,
    isSinglePlayer,
    gameMode,
    onConnectionError,
  });
  const [playerStrategies, setPlayerStrategies] = useState<PlayerStrategyData>(
    {},
  );
  const lastEventCountRef = useRef(0);

  const hasPlayableActions = useMemo(
    () => computeHasPlayableActions(game.gameState, game.playerId),
    [game.gameState, game.playerId],
  );

  const hasTreasuresInHand = useMemo(
    () => computeHasTreasuresInHand(game.gameState, game.playerId),
    [game.gameState, game.playerId],
  );

  // Fetch strategy analysis when turns end
  useEffect(() => {
    const { events, gameState } = game;
    if (!gameState || events.length <= lastEventCountRef.current) return;

    const newEvents = events.slice(lastEventCountRef.current);
    lastEventCountRef.current = events.length;

    const hasTurnEnded = newEvents.some(e => e.type === "TURN_ENDED");
    if (!hasTurnEnded || gameState.turn < MIN_TURN_FOR_STRATEGY) return;

    api.api["analyze-strategy"]
      .post({ currentState: gameState })
      .then(({ data }) => {
        if (data?.strategySummary?.length) {
          const record = data.strategySummary.reduce<PlayerStrategyData>(
            (acc, item) => {
              acc[item.id] = {
                gameplan: item.gameplan,
                read: item.read,
                recommendation: item.recommendation,
              };
              return acc;
            },
            {},
          );
          setPlayerStrategies(record);
        }
      })
      .catch(() => {});
  }, [game.events, game.gameState]);

  // No-op unplayTreasure for multiplayer
  const unplayTreasure = (_card: CardName): CommandResult => {
    return { ok: false, error: "Unplay treasure not supported in multiplayer" };
  };

  // Handle mode change
  const handleGameModeChange = (mode: GameMode) => {
    if (isSinglePlayer) {
      game.changeGameMode(mode);
    }
    if (onGameModeChange) {
      onGameModeChange(mode);
    }
  };

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

  // Auto-skip action phase when no playable actions
  useEffect(() => {
    if (!game.gameState || game.isProcessing || isSpectator) return;

    const state = game.gameState;
    const isMyTurn = state.activePlayer === game.playerId;
    const shouldAutoSkip =
      state.phase === "action" &&
      isMyTurn &&
      !state.pendingDecision &&
      !state.gameOver &&
      !hasPlayableActions;

    if (shouldAutoSkip) {
      game.endPhase();
    }
  }, [game, hasPlayableActions, isSpectator]);

  // Build GameContext value
  const contextValue = useMemo(
    () => ({
      gameState: game.gameState,
      events: game.events,
      gameMode: isSinglePlayer ? gameMode : ("multiplayer" as const),
      isProcessing: !game.isConnected,
      isLoading: !game.isJoined,
      modelSettings: DEFAULT_MODEL_SETTINGS,
      playerStrategies,
      localPlayerId: game.playerId,
      localPlayerName: playerName,
      isSpectator,
      spectatorCount: game.spectatorCount,
      players: game.players,
      chatMessages: game.chatMessages,
      sendChat: game.sendChat,
      hasPlayableActions,
      hasTreasuresInHand,
      strategy: {
        getModeName: () => (isSinglePlayer ? gameMode : "multiplayer"),
      } as never,
      setGameMode: handleGameModeChange,
      setModelSettings: () => {},
      startGame: () => game.startGame(),
      playAction: game.playAction,
      playTreasure: game.playTreasure,
      unplayTreasure,
      playAllTreasures: game.playAllTreasures,
      buyCard: game.buyCard,
      endPhase: game.endPhase,
      submitDecision: game.submitDecision,
      requestUndo: game.requestUndo,
      getStateAtEvent: game.getStateAtEvent,
    }),
    [
      game,
      playerStrategies,
      hasPlayableActions,
      hasTreasuresInHand,
      isSinglePlayer,
      gameMode,
      handleGameModeChange,
      isSpectator,
      playerName,
    ],
  );

  // Get disconnected opponent (if any)
  const disconnectedOpponent = useMemo(() => {
    if (isSpectator || !game.playerId) return null;

    for (const [playerId, playerName] of game.disconnectedPlayers.entries()) {
      if (playerId !== game.playerId) {
        return { playerId, playerName };
      }
    }
    return null;
  }, [game.disconnectedPlayers, game.playerId, isSpectator]);

  // Show game board if game has started
  if (game.gameState) {
    // Wait for playerId to be set before rendering Board
    if (!isSpectator && !game.playerId) {
      return <BoardSkeleton />;
    }

    return (
      <GameContext.Provider value={contextValue}>
        <LLMLogsContext.Provider value={{ llmLogs: [] }}>
          <Suspense fallback={<BoardSkeleton />}>
            <Board onBackToHome={handleResign} />
          </Suspense>
          {isSpectator && <SpectatorBadge />}
          {disconnectedOpponent && (
            <DisconnectModal
              playerName={disconnectedOpponent.playerName}
              onLeave={handleResign}
            />
          )}
          {game.error && !isSinglePlayer && (
            <GameOverNotification
              message={game.error}
              onClose={() => {
                localStorage.removeItem("dominion_active_game");
                onBack();
              }}
            />
          )}
        </LLMLogsContext.Provider>
      </GameContext.Provider>
    );
  }

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
