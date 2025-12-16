interface BaseModalProps {
  children: React.ReactNode;
  zIndex?: number;
}

export function BaseModal({ children, zIndex = 1000 }: BaseModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0 0 0 / 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
          padding: "var(--space-10) 3.75rem",
          textAlign: "center",
          boxShadow: "var(--shadow-game-over)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
