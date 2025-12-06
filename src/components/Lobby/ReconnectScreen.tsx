/**
 * Reconnect Screen
 *
 * Shows when there's a saved multiplayer session and auto-reconnects.
 */
import { useEffect, useState } from "react";
import { useMultiplayer } from "../../context/MultiplayerContext";

interface ReconnectScreenProps {
  onBack: () => void;
}

export function ReconnectScreen({ onBack }: ReconnectScreenProps) {
  const { reconnectToSavedRoom, error, leaveRoom } = useMultiplayer();
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Auto-reconnect on mount
  useEffect(() => {
    let cancelled = false;

    const doReconnect = async () => {
      setIsReconnecting(true);
      try {
        await reconnectToSavedRoom();
      } catch (e) {
        console.error("[ReconnectScreen] Reconnect failed:", e);
        if (!cancelled) {
          setIsReconnecting(false);
        }
      }
    };

    doReconnect();

    return () => {
      cancelled = true;
    };
  }, [reconnectToSavedRoom]);

  const handleCancel = () => {
    leaveRoom();
    onBack();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        background: "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          padding: "var(--space-6)",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: "0 0 var(--space-4) 0",
            fontSize: "1.5rem",
            color: "var(--color-gold)",
          }}
        >
          {isReconnecting ? "Reconnecting..." : "Reconnect Failed"}
        </h1>

        {isReconnecting ? (
          <>
            <div
              style={{
                marginBottom: "var(--space-4)",
                color: "var(--color-text-secondary)",
              }}
            >
              Reconnecting to your game...
            </div>
            <div
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                border: "3px solid var(--color-border-primary)",
                borderTop: "3px solid var(--color-gold)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </>
        ) : (
          <>
            <div
              style={{
                marginBottom: "var(--space-4)",
                color: "var(--color-text-secondary)",
              }}
            >
              {error || "Could not reconnect to the game room."}
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-tertiary)",
                marginBottom: "var(--space-4)",
              }}
            >
              The host may have left or the room may have closed.
            </div>
            <button
              onClick={handleCancel}
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "var(--color-bg-tertiary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "6px",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.875rem",
              }}
            >
              Back to Home
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
