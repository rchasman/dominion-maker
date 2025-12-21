import { useState, useEffect } from "preact/hooks";
import { BaseModal } from "../Modal/BaseModal";
import type { GameEvent } from "../../events/types";

interface UndoRequestModalProps {
  requestId: string;
  byPlayerName: string;
  toEventId: string;
  events: GameEvent[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

const TIMEOUT_SECONDS = 30;

export function UndoRequestModal({
  requestId,
  byPlayerName,
  toEventId,
  events,
  onApprove,
  onDeny,
}: UndoRequestModalProps) {
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
  const [hasDenied, setHasDenied] = useState(false);

  // Find the target event
  const targetEvent = events.find(e => e.id === toEventId);
  const targetIndex = events.findIndex(e => e.id === toEventId);

  // If event not found, auto-deny immediately
  useEffect(() => {
    if (!targetEvent && !hasDenied) {
      setHasDenied(true);
      onDeny(requestId);
    }
  }, [targetEvent, hasDenied, requestId, onDeny]);

  // Countdown timer
  useEffect(() => {
    if (hasDenied) return;

    if (timeLeft <= 0) {
      setHasDenied(true);
      onDeny(requestId);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, requestId, onDeny, hasDenied]);

  const handleApprove = () => {
    if (hasDenied) return;
    onApprove(requestId);
  };

  const handleDeny = () => {
    if (hasDenied) return;
    setHasDenied(true);
    onDeny(requestId);
  };

  // Don't render if event not found
  if (!targetEvent) {
    return null;
  }

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
            <div>Move #{targetIndex + 1}</div>
            <div style={{ marginTop: "var(--space-2)" }}>
              {targetEvent.type}
            </div>
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
              padding: "var(--space-4) var(--space-8)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background:
                "linear-gradient(180deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "2px solid #10b981",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            Approve
          </button>

          <button
            onClick={handleDeny}
            style={{
              padding: "var(--space-4) var(--space-8)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background:
                "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
              color: "#fff",
              border: "2px solid #dc2626",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              boxShadow: "var(--shadow-lg)",
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
