interface DisconnectModalProps {
  playerName: string;
  onLeave: () => void;
}

export function DisconnectModal({ playerName, onLeave }: DisconnectModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0 0 0 / 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
          padding: "var(--space-10) 3.75rem",
          textAlign: "center",
          border: "2px solid #ef5350",
          boxShadow: "var(--shadow-game-over)",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--space-6) 0",
            color: "#ef5350",
            fontSize: "1.75rem",
          }}
        >
          Player Disconnected
        </h2>
        <p
          style={{
            fontSize: "1.125rem",
            margin: 0,
            color: "var(--color-text-primary)",
          }}
        >
          {playerName} has disconnected.
        </p>
        <p
          style={{
            fontSize: "0.875rem",
            marginBlockStart: "var(--space-4)",
            color: "var(--color-text-muted)",
          }}
        >
          Waiting for them to reconnect...
        </p>
        <button
          onClick={onLeave}
          style={{
            marginBlockStart: "var(--space-6)",
            padding: "var(--space-4) var(--space-8)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "linear-gradient(180deg, #666 0%, #555 100%)",
            color: "#fff",
            border: "2px solid #888",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.125rem",
            fontFamily: "inherit",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}
