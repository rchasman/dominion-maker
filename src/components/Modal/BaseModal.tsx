import { useEffect, useRef } from "preact/hooks";

interface BaseModalProps {
  children: React.ReactNode;
  zIndex?: number;
  ariaLabel?: string;
  onClose?: () => void;
}

export function BaseModal({
  children,
  zIndex = 1000,
  ariaLabel = "Dialog",
  onClose,
}: BaseModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0 0 0 / 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
        outline: "none",
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
