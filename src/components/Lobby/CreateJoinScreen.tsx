/**
 * Create/Join Room Screen
 *
 * Initial screen for multiplayer - create a new room or join existing.
 */
import { useState } from "react";
import { useMultiplayer } from "../../context/MultiplayerContext";

interface CreateJoinScreenProps {
  onBack: () => void;
}

export function CreateJoinScreen({ onBack }: CreateJoinScreenProps) {
  const { createRoom, joinRoom, isConnecting, error } = useMultiplayer();

  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"select" | "create" | "join">("select");

  const handleCreate = async () => {
    if (!playerName.trim()) return;
    try {
      await createRoom(playerName.trim());
    } catch {
      // Error is handled in context
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    try {
      await joinRoom(joinCode.trim(), playerName.trim());
    } catch {
      // Error is handled in context
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-8)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "3rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        MULTIPLAYER
      </h1>

      {error && (
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
          {error}
        </div>
      )}

      {mode === "select" && (
        <>
          {/* Player Name Input */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              alignItems: "center",
            }}
          >
            <label
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1rem",
              }}
            >
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "1rem",
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "4px",
                color: "var(--color-text-primary)",
                width: "250px",
                textAlign: "center",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
            }}
          >
            <button
              onClick={() => setMode("create")}
              disabled={!playerName.trim()}
              style={{
                padding: "var(--space-4) var(--space-8)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: playerName.trim()
                  ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
                  : "var(--color-bg-tertiary)",
                color: playerName.trim() ? "#fff" : "var(--color-text-tertiary)",
                border: playerName.trim()
                  ? "2px solid var(--color-victory)"
                  : "2px solid var(--color-border-primary)",
                cursor: playerName.trim() ? "pointer" : "not-allowed",
                textTransform: "uppercase",
                letterSpacing: "0.1rem",
                fontFamily: "inherit",
                borderRadius: "4px",
              }}
            >
              Create Room
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!playerName.trim()}
              style={{
                padding: "var(--space-4) var(--space-8)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: playerName.trim()
                  ? "var(--color-bg-secondary)"
                  : "var(--color-bg-tertiary)",
                color: playerName.trim()
                  ? "var(--color-text-primary)"
                  : "var(--color-text-tertiary)",
                border: playerName.trim()
                  ? "1px solid var(--color-border-primary)"
                  : "1px solid var(--color-border-primary)",
                cursor: playerName.trim() ? "pointer" : "not-allowed",
                textTransform: "uppercase",
                letterSpacing: "0.1rem",
                fontFamily: "inherit",
                borderRadius: "4px",
              }}
            >
              Join Room
            </button>
          </div>
        </>
      )}

      {mode === "create" && (
        <>
          <p
            style={{
              color: "var(--color-text-secondary)",
              margin: 0,
              fontSize: "0.875rem",
            }}
          >
            Creating room as <strong>{playerName}</strong>
          </p>
          <button
            onClick={handleCreate}
            disabled={isConnecting}
            style={{
              padding: "var(--space-6) var(--space-10)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background:
                "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
              color: "#fff",
              border: "2px solid var(--color-victory)",
              cursor: isConnecting ? "wait" : "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.125rem",
              fontFamily: "inherit",
              boxShadow: "var(--shadow-lg)",
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? "Creating..." : "Create Room"}
          </button>
          <button
            onClick={() => setMode("select")}
            style={{
              padding: "var(--space-2) var(--space-4)",
              fontSize: "0.75rem",
              background: "transparent",
              color: "var(--color-text-tertiary)",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Back
          </button>
        </>
      )}

      {mode === "join" && (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              alignItems: "center",
            }}
          >
            <label
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1rem",
              }}
            >
              Room Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF"
              maxLength={6}
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "1.5rem",
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "4px",
                color: "var(--color-text-primary)",
                width: "150px",
                textAlign: "center",
                fontFamily: "monospace",
                letterSpacing: "0.25rem",
              }}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={isConnecting || joinCode.length < 6}
            style={{
              padding: "var(--space-6) var(--space-10)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background:
                joinCode.length >= 6
                  ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
                  : "var(--color-bg-tertiary)",
              color: joinCode.length >= 6 ? "#fff" : "var(--color-text-tertiary)",
              border:
                joinCode.length >= 6
                  ? "2px solid var(--color-victory)"
                  : "2px solid var(--color-border-primary)",
              cursor:
                isConnecting || joinCode.length < 6 ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.125rem",
              fontFamily: "inherit",
              boxShadow: "var(--shadow-lg)",
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? "Joining..." : "Join Room"}
          </button>
          <button
            onClick={() => setMode("select")}
            style={{
              padding: "var(--space-2) var(--space-4)",
              fontSize: "0.75rem",
              background: "transparent",
              color: "var(--color-text-tertiary)",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Back
          </button>
        </>
      )}

      {/* Back to main menu */}
      <button
        onClick={onBack}
        style={{
          marginTop: "var(--space-8)",
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
        Back to Single Player
      </button>
    </div>
  );
}
