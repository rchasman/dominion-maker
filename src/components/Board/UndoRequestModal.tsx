import { useState, useEffect } from "preact/hooks";
import { BaseModal } from "../Modal/BaseModal";
import type { PlayerId } from "../../types/game-state";
import type { GameEvent } from "../../events/types";

interface UndoRequestModalProps {
  requestId: string;
  byPlayer: PlayerId;
  byPlayerName: string;
  toEventId: string;
  events: GameEvent[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

const TIMEOUT_SECONDS = 30;

export function UndoRequestModal({
  requestId,
  byPlayer,
  byPlayerName,
  toEventId,
  events,
  onApprove,
  onDeny,
}: UndoRequestModalProps) {
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);

  // Find the target event
  const targetEvent = events.find(e => e.id === toEventId);
  const targetIndex = events.findIndex(e => e.id === toEventId);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onDeny(requestId);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, requestId, onDeny]);

  const handleApprove = () => {
    onApprove(requestId);
  };

  const handleDeny = () => {
    onDeny(requestId);
  };

  return (
    <BaseModal zIndex={2000}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          minWidth: "400px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.5rem",
            color: "var(--color-gold)",
            textTransform: "uppercase",
            letterSpacing: "0.125rem",
          }}
        >
          Undo Request
        </h2>

        <div
          style={{
            color: "var(--color-text-primary)",
            fontSize: "1rem",
            lineHeight: 1.5,
          }}
        >
          <div style={{ marginBottom: "var(--space-4)" }}>
            <strong style={{ color: "var(--color-text-secondary)" }}>
              {byPlayerName}
            </strong>{" "}
            wants to undo to:
          </div>

          <div
            style={{
              padding: "var(--space-3)",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              color: "var(--color-text-tertiary)",
            }}
          >
            {targetEvent ? (
              <>
                <div>Move #{targetIndex + 1}</div>
                <div style={{ marginTop: "var(--space-2)" }}>
                  {targetEvent.type}
                </div>
              </>
            ) : (
              "Unknown event"
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            justifyContent: "center",
          }}
        >
          <button
            onClick={handleApprove}
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: "var(--color-action-success)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              boxShadow: "var(--shadow-md)",
            }}
          >
            Approve
          </button>

          <button
            onClick={handleDeny}
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: "var(--color-action-error)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              boxShadow: "var(--shadow-md)",
            }}
          >
            Deny
          </button>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
          }}
        >
          Auto-denying in {timeLeft}s...
        </div>
      </div>
    </BaseModal>
  );
}
