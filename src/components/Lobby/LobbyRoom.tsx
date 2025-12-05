/**
 * Lobby Room Screen
 *
 * Shows connected players, ready status, and game settings.
 */
import { useMultiplayer } from "../../context/MultiplayerContext";

export function LobbyRoom() {
  const {
    roomCode,
    isHost,
    myPlayerId,
    lobbyState,
    multiplayerState,
    setReady,
    startGame,
    setGameMode,
    leaveRoom,
  } = useMultiplayer();

  if (!lobbyState || !multiplayerState) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minBlockSize: "100dvh",
          color: "var(--color-text-secondary)",
        }}
      >
        Loading...
      </div>
    );
  }

  const myPresence = myPlayerId ? lobbyState.players[myPlayerId] : null;
  const isReady = myPresence?.ready ?? false;
  const allPlayers = Object.values(lobbyState.players);
  const readyCount = allPlayers.filter((p) => p.ready).length;
  const canStart =
    isHost &&
    allPlayers.length >= lobbyState.config.minPlayers &&
    readyCount === allPlayers.length;

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
        LOBBY
      </h1>

      {/* Room Code */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-2)",
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
          Room Code
        </span>
        <div
          style={{
            padding: "var(--space-3) var(--space-6)",
            background: "var(--color-bg-tertiary)",
            border: "2px dashed var(--color-gold)",
            borderRadius: "4px",
            fontSize: "2rem",
            fontFamily: "monospace",
            color: "var(--color-gold)",
            letterSpacing: "0.5rem",
            fontWeight: 700,
          }}
        >
          {roomCode}
        </div>
        <span
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
          }}
        >
          Share this code with friends to join
        </span>
      </div>

      {/* Players List */}
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
            {allPlayers.length}/{lobbyState.config.maxPlayers ?? 4}
          </span>
        </div>

        {multiplayerState.playerSlots.map((slot, i) => {
          const presence = lobbyState.players[slot.id];
          const isMe = slot.id === myPlayerId;
          return (
            <div
              key={slot.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-2)",
                background: isMe
                  ? "rgba(34, 197, 94, 0.1)"
                  : "var(--color-bg-tertiary)",
                borderRadius: "4px",
                border: isMe
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : "1px solid transparent",
              }}
            >
              {/* Player number */}
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

              {/* Player name */}
              <span
                style={{
                  flex: 1,
                  color: isMe
                    ? "var(--color-victory)"
                    : "var(--color-text-primary)",
                  fontWeight: isMe ? 600 : 400,
                }}
              >
                {slot.name}
                {isMe && " (you)"}
                {slot.type === "ai" && " [AI]"}
              </span>

              {/* Ready indicator */}
              <span
                style={{
                  padding: "var(--space-1) var(--space-2)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  borderRadius: "4px",
                  background: presence?.ready
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(234, 179, 8, 0.2)",
                  color: presence?.ready ? "#22c55e" : "#eab308",
                  border: presence?.ready
                    ? "1px solid rgba(34, 197, 94, 0.5)"
                    : "1px solid rgba(234, 179, 8, 0.5)",
                }}
              >
                {presence?.ready ? "Ready" : "Not Ready"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Game Mode (Host only) */}
      {isHost && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            alignItems: "center",
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
            AI Mode
          </span>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
            }}
          >
            {(["engine", "hybrid", "llm"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGameMode(mode)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  fontSize: "0.75rem",
                  background:
                    multiplayerState.settings.gameMode === mode
                      ? "var(--color-victory-dark)"
                      : "transparent",
                  color:
                    multiplayerState.settings.gameMode === mode
                      ? "#fff"
                      : "var(--color-text-secondary)",
                  border: "1px solid",
                  borderColor:
                    multiplayerState.settings.gameMode === mode
                      ? "var(--color-victory)"
                      : "var(--color-border-primary)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                  borderRadius: "4px",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
        }}
      >
        <button
          onClick={() => setReady(!isReady)}
          style={{
            padding: "var(--space-4) var(--space-8)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: isReady
              ? "rgba(234, 179, 8, 0.2)"
              : "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
            color: isReady ? "#eab308" : "#fff",
            border: isReady
              ? "2px solid rgba(234, 179, 8, 0.5)"
              : "2px solid var(--color-victory)",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.1rem",
            fontFamily: "inherit",
            borderRadius: "4px",
          }}
        >
          {isReady ? "Cancel Ready" : "Ready"}
        </button>

        {isHost && (
          <button
            onClick={startGame}
            disabled={!canStart}
            style={{
              padding: "var(--space-4) var(--space-8)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: canStart
                ? "linear-gradient(180deg, var(--color-gold) 0%, #b8860b 100%)"
                : "var(--color-bg-tertiary)",
              color: canStart ? "#000" : "var(--color-text-tertiary)",
              border: canStart
                ? "2px solid var(--color-gold)"
                : "2px solid var(--color-border-primary)",
              cursor: canStart ? "pointer" : "not-allowed",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
            }}
          >
            Start Game
          </button>
        )}
      </div>

      {/* Status message */}
      <p
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "0.75rem",
          margin: 0,
        }}
      >
        {readyCount}/{allPlayers.length} players ready
        {!canStart &&
          isHost &&
          allPlayers.length < lobbyState.config.minPlayers &&
          ` (need ${lobbyState.config.minPlayers} players minimum)`}
      </p>

      {/* Leave button */}
      <button
        onClick={leaveRoom}
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
