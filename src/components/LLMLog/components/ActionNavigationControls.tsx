interface ActionNavigationControlsProps {
  hasPrevAction: boolean;
  hasNextAction: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ActionNavigationControls({
  hasPrevAction,
  hasNextAction,
  onPrev,
  onNext,
}: ActionNavigationControlsProps) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
    >
      <button
        onClick={onPrev}
        disabled={!hasPrevAction}
        onMouseEnter={e =>
          hasPrevAction && (e.currentTarget.style.opacity = "0.5")
        }
        onMouseLeave={e =>
          hasPrevAction && (e.currentTarget.style.opacity = "1")
        }
        style={{
          background: "none",
          border: "none",
          color: hasPrevAction
            ? "var(--color-action)"
            : "var(--color-text-secondary)",
          cursor: hasPrevAction ? "pointer" : "not-allowed",
          fontSize: "0.85rem",
          fontWeight: 700,
          fontFamily: "inherit",
          opacity: hasPrevAction ? 1 : 0.3,
          padding: "var(--space-2)",
          minWidth: "24px",
          minHeight: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.15s",
        }}
      >
        ←
      </button>
      <button
        onClick={onNext}
        disabled={!hasNextAction}
        onMouseEnter={e =>
          hasNextAction && (e.currentTarget.style.opacity = "0.5")
        }
        onMouseLeave={e =>
          hasNextAction && (e.currentTarget.style.opacity = "1")
        }
        style={{
          background: "none",
          border: "none",
          color: hasNextAction
            ? "var(--color-action)"
            : "var(--color-text-secondary)",
          cursor: hasNextAction ? "pointer" : "not-allowed",
          fontSize: "0.85rem",
          fontWeight: 700,
          fontFamily: "inherit",
          opacity: hasNextAction ? 1 : 0.3,
          padding: "var(--space-2)",
          minWidth: "24px",
          minHeight: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.15s",
        }}
      >
        →
      </button>
    </div>
  );
}
