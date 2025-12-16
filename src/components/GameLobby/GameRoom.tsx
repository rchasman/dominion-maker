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

const Board = lazy(() => import("../Board").then(m => ({ default: m.Board })));

interface GameRoomProps {
  roomId: string;
  playerName: string;
  isSpectator: boolean;
  onBack: () => void;
}

export function GameRoom({
  roomId,
  playerName,
  isSpectator,
  onBack,
}: GameRoomProps) {
  // Single connection - used for both waiting room and game
  const game = usePartyGame({ roomId, playerName, isSpectator });
  const [playerStrategies, setPlayerStrategies] = useState<PlayerStrategyData>({});
  const lastEventCountRef = useRef(0);

  const hasPlayableActions = useMemo(
    () => computeHasPlayableActions(game.gameState),
    [game.gameState],
  );

  const hasTreasuresInHand = useMemo(
    () => computeHasTreasuresInHand(game.gameState),
    [game.gameState],
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

  // Build GameContext value
  const contextValue = useMemo(
    () => ({
      gameState: game.gameState,
      events: game.events,
      gameMode: "multiplayer" as const,
      isProcessing: !game.isConnected,
      isLoading: !game.isJoined,
      modelSettings: DEFAULT_MODEL_SETTINGS,
      playerStrategies,
      localPlayerId: game.playerId,
      hasPlayableActions,
      hasTreasuresInHand,
      strategy: { getModeName: () => "multiplayer" } as never,
      setGameMode: () => {},
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
    [game, playerStrategies, hasPlayableActions, hasTreasuresInHand],
  );

  // Show game board if game has started
  if (game.gameState) {
    return (
      <GameContext.Provider value={contextValue}>
        <LLMLogsContext.Provider value={{ llmLogs: [] }}>
          <Suspense fallback={<BoardSkeleton />}>
            <Board onBackToHome={onBack} />
          </Suspense>
          {isSpectator && <SpectatorBadge />}
        </LLMLogsContext.Provider>
      </GameContext.Provider>
    );
  }

  // Show waiting room
  return <WaitingRoom game={game} isSpectator={isSpectator} onBack={onBack} />;
}

interface WaitingRoomProps {
  game: ReturnType<typeof usePartyGame>;
  isSpectator: boolean;
  onBack: () => void;
}

function WaitingRoom({ game, isSpectator, onBack }: WaitingRoomProps) {
  const canStart = game.isHost && game.players.length >= 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-6)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "2rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        {isSpectator ? "SPECTATING" : "WAITING ROOM"}
      </h1>

      {game.error && (
        <div
          style={{
            padding: "var(--space-4)",
            background: "rgba(220, 38, 38, 0.2)",
            border: "1px solid rgba(220, 38, 38, 0.5)",
            borderRadius: "4px",
            color: "#fca5a5",
            fontSize: "0.875rem",
          }}
        >
          {game.error}
        </div>
      )}

      <PlayerList
        players={game.players}
        myPlayerId={game.playerId}
        spectatorCount={game.spectatorCount}
      />

      {!isSpectator && (
        <>
          {game.isHost ? (
            <button
              onClick={() => game.startGame()}
              disabled={!canStart}
              style={{
                padding: "var(--space-6) var(--space-10)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: canStart
                  ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
                  : "var(--color-bg-tertiary)",
                color: canStart ? "#fff" : "var(--color-text-tertiary)",
                border: canStart
                  ? "2px solid var(--color-victory)"
                  : "2px solid var(--color-border-primary)",
                cursor: canStart ? "pointer" : "not-allowed",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                boxShadow: canStart ? "var(--shadow-lg)" : "none",
                borderRadius: "4px",
              }}
            >
              Start Game
            </button>
          ) : (
            <p
              style={{
                color: "var(--color-text-tertiary)",
                fontSize: "0.875rem",
                margin: 0,
              }}
            >
              Waiting for host to start...
            </p>
          )}
        </>
      )}

      {isSpectator && (
        <p
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.875rem",
            margin: 0,
          }}
        >
          Waiting for game to start...
        </p>
      )}

      <button
        onClick={onBack}
        style={{
          marginTop: "var(--space-4)",
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
        Leave Room
      </button>
    </div>
  );
}

interface PlayerListProps {
  players: Array<{ name: string; playerId: string }>;
  myPlayerId: string | null;
  spectatorCount: number;
}

function PlayerList({ players, myPlayerId, spectatorCount }: PlayerListProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "8px",
        minWidth: "300px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--color-border-primary)",
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.1rem",
          }}
        >
          Players
        </span>
        <span
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
          }}
        >
          {players.length}/4
        </span>
      </div>

      {players.map((player, i) => (
        <div
          key={player.playerId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-2)",
            background:
              player.playerId === myPlayerId
                ? "rgba(34, 197, 94, 0.1)"
                : "var(--color-bg-tertiary)",
            borderRadius: "4px",
            border:
              player.playerId === myPlayerId
                ? "1px solid rgba(34, 197, 94, 0.3)"
                : "1px solid transparent",
          }}
        >
          <span
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-bg-primary)",
              borderRadius: "50%",
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
            }}
          >
            {i + 1}
          </span>

          <span
            style={{
              flex: 1,
              color:
                player.playerId === myPlayerId
                  ? "var(--color-victory)"
                  : "var(--color-text-primary)",
              fontWeight: player.playerId === myPlayerId ? 600 : 400,
            }}
          >
            {player.name}
            {player.playerId === myPlayerId && " (you)"}
            {i === 0 && " [Host]"}
          </span>
        </div>
      ))}

      {spectatorCount > 0 && (
        <div
          style={{
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--color-border-primary)",
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
          }}
        >
          {spectatorCount} spectator{spectatorCount !== 1 ? "s" : ""} watching
        </div>
      )}
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
