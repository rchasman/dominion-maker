import { uiLogger } from "../../lib/logger";
/**
 * Create/Join Room Screen
 *
 * Initial screen for multiplayer - create a new room or join existing.
 */
import { useState, useEffect } from "react";
import { useMultiplayer } from "../../context/MultiplayerContext";

interface CreateJoinScreenProps {
  onBack: () => void;
}

export function CreateJoinScreen({ onBack }: CreateJoinScreenProps) {
  const { createRoom, joinRoom, isConnecting, isReconnecting, error, hasSavedSession, reconnectToSavedRoom } = useMultiplayer();

  // Auto-reconnect on mount if saved session exists
  useEffect(() => {
    if (hasSavedSession && !isConnecting && !isReconnecting) {
      uiLogger.debug("[CreateJoinScreen] Auto-reconnecting to saved session");
      reconnectToSavedRoom().catch((e) => {
        uiLogger.error("[CreateJoinScreen] Auto-reconnect failed:", e);
      });
    }
  }, [hasSavedSession, reconnectToSavedRoom, isConnecting, isReconnecting]);

  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCreate = async () => {
    try {
      // Auto-generate player name
      const randomName = `Player${Math.floor(Math.random() * 9999)}`;
      await createRoom(randomName);
    } catch {
      // Error is handled in context
    }
  };

  const handleJoin = async () => {
    if (joinCode.length < 6) return;
    try {
      const randomName = `Player${Math.floor(Math.random() * 9999)}`;
      await joinRoom(joinCode.trim(), randomName);
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

      {!showJoinInput && (
        <>
          {hasSavedSession && (
            <p
              style={{
                color: "var(--color-text-secondary)",
                margin: 0,
                fontSize: "0.875rem",
              }}
            >
              You have an active game session
            </p>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              alignItems: "stretch",
              minWidth: "300px",
            }}
          >
            {hasSavedSession && (
              <button
                onClick={reconnectToSavedRoom}
                disabled={isConnecting || isReconnecting}
                style={{
                  padding: "var(--space-6) var(--space-10)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
                  color: "#fff",
                  border: "2px solid #3b82f6",
                  cursor: (isConnecting || isReconnecting) ? "wait" : "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.125rem",
                  fontFamily: "inherit",
                  boxShadow: "var(--shadow-lg)",
                  opacity: (isConnecting || isReconnecting) ? 0.7 : 1,
                  borderRadius: "4px",
                }}
              >
                {isReconnecting ? "Reconnecting..." : "Rejoin Room"}
              </button>
            )}
            <button
              onClick={handleCreate}
              disabled={isConnecting || isReconnecting}
              style={{
                padding: "var(--space-6) var(--space-10)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
                color: "#fff",
                border: "2px solid var(--color-victory)",
                cursor: (isConnecting || isReconnecting) ? "wait" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                boxShadow: "var(--shadow-lg)",
                opacity: (isConnecting || isReconnecting) ? 0.7 : 1,
                borderRadius: "4px",
              }}
            >
              {isConnecting ? "Creating..." : "Create Room"}
            </button>
            <button
              onClick={() => setShowJoinInput(true)}
              disabled={isConnecting || isReconnecting}
              style={{
                padding: "var(--space-6) var(--space-10)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "var(--color-bg-secondary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                cursor: (isConnecting || isReconnecting) ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                boxShadow: "var(--shadow-lg)",
                borderRadius: "4px",
              }}
            >
              Join Room
            </button>
          </div>
        </>
      )}

      {showJoinInput && (
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
            onClick={() => setShowJoinInput(false)}
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
