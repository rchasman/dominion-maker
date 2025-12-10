import type { GameMode } from "../../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../../types/game-mode";

interface EmptyStateProps {
  gameMode: GameMode;
}

export function EmptyState({ gameMode }: EmptyStateProps) {
  const { title, description } =
    gameMode === "multiplayer"
      ? { title: "", description: "" }
      : GAME_MODE_CONFIG[gameMode].logDescription;

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
