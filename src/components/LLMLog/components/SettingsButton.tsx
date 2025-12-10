interface SettingsButtonProps {
  isExpanded: boolean;
  onClick: () => void;
}

export function SettingsButton({ isExpanded, onClick }: SettingsButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: isExpanded
          ? "var(--color-action)"
          : "var(--color-text-secondary)",
        cursor: "pointer",
        fontSize: "0.875rem",
        fontWeight: 400,
        fontFamily: "inherit",
        padding: "var(--space-2)",
        minWidth: "24px",
        minHeight: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.15s",
      }}
      onMouseEnter={e =>
        !isExpanded && (e.currentTarget.style.color = "var(--color-gold)")
      }
      onMouseLeave={e =>
        !isExpanded &&
        (e.currentTarget.style.color = "var(--color-text-secondary)")
      }
      title="Model Settings"
    >
      ⚙
    </button>
  );
}
