/**
 * Lobby Room Screen - Simplified P2P version
 *
 * Shows connected players and allows host to start game.
 */
import { useMultiplayer } from "../../context/MultiplayerContext";

export function LobbyRoom() {
  const { roomCode, isHost, myPeerId, players, startGame, leaveRoom } =
    useMultiplayer();

  const canStart = isHost && players.length >= 2;

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
            {players.length}/4
          </span>
        </div>

        {players.map((player, i) => {
          const isMe = player.id === myPeerId;
          return (
            <div
              key={player.id}
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
                {player.name}
                {isMe && " (you)"}
                {player.isAI && " [AI]"}
                {!player.connected && " [Disconnected]"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Start button (host only) */}
      {isHost && (
        <button
          onClick={startGame}
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
          }}
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "0.75rem",
            margin: 0,
          }}
        >
          Waiting for host to start...
        </p>
      )}

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
