/** A button that only makes sense beside a board: Take back, Resign, Pass */
export function BoardButton({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "var(--space-2) var(--space-5)",
        fontSize: "0.75rem",
        fontFamily: "inherit",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        background: "var(--color-victory-dark)",
        color: "#fff",
        border: "1px solid var(--color-victory)",
        borderRadius: "4px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
