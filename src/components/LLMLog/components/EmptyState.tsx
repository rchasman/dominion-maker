interface EmptyStateProps {
  hasLlmSeats: boolean;
}

export function EmptyState({ hasLlmSeats }: EmptyStateProps) {
  const title = hasLlmSeats ? "Consensus Viewer" : "No LLM seat at the table";
  const description = hasLlmSeats
    ? "Consensus decisions appear here when an LLM seat acts."
    : "Set a player's controller to LLM to see votes here.";

  return (
    <div
      style={{
        padding: "var(--space-4)",
        paddingTop: "var(--space-3)",
        textAlign: "center",
        color: "var(--color-text-secondary)",
        fontSize: "0.75rem",
        lineHeight: 1.6,
      }}
    >
      <div style={{ marginBottom: "var(--space-2)" }}>{title}</div>
      <div style={{ fontSize: "0.6875rem", opacity: 0.7 }}>{description}</div>
    </div>
  );
}
