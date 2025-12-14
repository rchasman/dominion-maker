import { uiLogger } from "../../lib/logger";
/**
 * Reconnect Screen
 *
 * Shows options when there's a saved multiplayer session.
 */
import { useState } from "preact/hooks";
import { useMultiplayer } from "../../context/multiplayer-hooks";

interface ReconnectScreenProps {
  onBack: () => void;
}

const BUTTON_OPACITY_DISABLED = 0.7;

interface ReconnectButtonsProps {
  isReconnecting: boolean;
  onReconnect: () => void;
  onStartNew: () => void;
}

function ReconnectButtons({
  isReconnecting,
  onReconnect,
  onStartNew,
}: ReconnectButtonsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        alignItems: "stretch",
        minWidth: "300px",
      }}
    >
      <button
        onClick={onReconnect}
        disabled={isReconnecting}
        style={{
          padding: "var(--space-6) var(--space-10)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
          color: "#fff",
          border: "2px solid #3b82f6",
          cursor: isReconnecting ? "wait" : "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
          opacity: isReconnecting ? BUTTON_OPACITY_DISABLED : 1,
          borderRadius: "4px",
        }}
      >
        {isReconnecting ? "Reconnecting..." : "Rejoin Room"}
      </button>

      <button
        onClick={onStartNew}
        disabled={isReconnecting}
        style={{
          padding: "var(--space-4) var(--space-8)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background: "var(--color-bg-secondary)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-primary)",
          cursor: isReconnecting ? "not-allowed" : "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
          fontFamily: "inherit",
          borderRadius: "4px",
        }}
      >
        Start New Game
      </button>
    </div>
  );
}

interface ScreenHeaderProps {
  error: string | null;
}

function ScreenHeader({ error }: ScreenHeaderProps) {
  return (
    <>
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

      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: 0,
          fontSize: "0.875rem",
        }}
      >
        You have an active game session
      </p>
    </>
  );
}

export function ReconnectScreen({ onBack }: ReconnectScreenProps) {
  const { reconnectToSavedRoom, error } = useMultiplayer();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await reconnectToSavedRoom();
    } catch (e) {
      uiLogger.error("[ReconnectScreen] Reconnect failed:", e);
      setIsReconnecting(false);
    }
  };

  const handleStartNew = () => {
    // Clear saved session
    localStorage.removeItem("dominion-maker-multiplayer-events");
    localStorage.removeItem("dominion-maker-multiplayer-room");
    // Reload to reset MultiplayerProvider state
    window.location.reload();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
        padding: "var(--space-4)",
        gap: "var(--space-6)",
      }}
    >
      <ScreenHeader error={error} />

      <ReconnectButtons
        isReconnecting={isReconnecting}
        onReconnect={handleReconnect}
        onStartNew={handleStartNew}
      />

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
        Back to Main Menu
      </button>
    </div>
  );
}
