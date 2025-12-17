import type { GameMode } from "../types/game-mode";
import { GAME_MODE_CONFIG } from "../types/game-mode";

const FONT_WEIGHT_ACTIVE = 700;
const FONT_WEIGHT_INACTIVE = 400;

interface StartScreenProps {
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  onStartSinglePlayer?: () => void;
  onStartMultiplayer?: () => void;
}

function getModeDescription(gameMode: string): string {
  if (gameMode === "multiplayer") {
    return "";
  }
  const config = GAME_MODE_CONFIG[gameMode as keyof typeof GAME_MODE_CONFIG];
  return config?.description ?? "";
}

function renderModeButtons(
  gameMode: string,
  setGameMode: (mode: "engine" | "hybrid" | "full") => void,
) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "8px",
      }}
    >
      <ModeButton mode="engine" current={gameMode} onClick={setGameMode} />
      <ModeButton mode="hybrid" current={gameMode} onClick={setGameMode} />
      <ModeButton mode="full" current={gameMode} onClick={setGameMode} />
    </div>
  );
}

function renderActionButtons(
  onStartSinglePlayer?: () => void,
  onStartMultiplayer?: () => void,
) {
  // Prefetch modules on hover for instant perceived load
  const prefetchSinglePlayer = () => void import("../SinglePlayerApp");
  const prefetchMultiplayer = () => void import("./GameLobby");

  return (
    <div style={{ display: "flex", gap: "var(--space-4)" }}>
      <button
        onClick={onStartSinglePlayer}
        onMouseEnter={prefetchSinglePlayer}
        onFocus={prefetchSinglePlayer}
        style={{
          padding: "var(--space-6) var(--space-10)",
          fontSize: "0.875rem",
          fontWeight: 600,
          background:
            "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
          color: "#fff",
          border: "2px solid var(--color-victory)",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        Single Player
      </button>

      {onStartMultiplayer && (
        <button
          onClick={onStartMultiplayer}
          onMouseEnter={prefetchMultiplayer}
          onFocus={prefetchMultiplayer}
          style={{
            padding: "var(--space-6) var(--space-10)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
            color: "#fff",
            border: "2px solid #3b82f6",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.125rem",
            fontFamily: "inherit",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          Multiplayer
        </button>
      )}
    </div>
  );
}

export function StartScreen({
  gameMode,
  onGameModeChange,
  onStartSinglePlayer,
  onStartMultiplayer,
}: StartScreenProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-8)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "3rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        DOMINION
      </h1>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: 0,
          fontSize: "0.875rem",
          textTransform: "uppercase",
          letterSpacing: "0.125rem",
        }}
      >
        Base Game
      </p>

      {renderModeButtons(gameMode, onGameModeChange)}

      <p
        style={{
          color: "var(--color-text-tertiary)",
          margin: 0,
          fontSize: "0.75rem",
          maxWidth: "500px",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        {getModeDescription(gameMode)}
      </p>

      {renderActionButtons(onStartSinglePlayer, onStartMultiplayer)}
    </div>
  );
}

function ModeButton({
  mode,
  current,
  onClick,
}: {
  mode: "engine" | "hybrid" | "full";
  current: string;
  onClick: (mode: "engine" | "hybrid" | "full") => void;
}) {
  const isActive = mode === current;
  return (
    <button
      onClick={() => onClick(mode)}
      style={{
        padding: "var(--space-3) var(--space-6)",
        fontSize: "0.75rem",
        fontWeight: isActive ? FONT_WEIGHT_ACTIVE : FONT_WEIGHT_INACTIVE,
        background: isActive ? "var(--color-victory-dark)" : "transparent",
        color: isActive ? "#fff" : "var(--color-text-secondary)",
        border: "1px solid",
        borderColor: isActive
          ? "var(--color-victory)"
          : "var(--color-border-primary)",
        cursor: "pointer",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        fontFamily: "inherit",
        borderRadius: "4px",
      }}
    >
      {GAME_MODE_CONFIG[mode].name}
    </button>
  );
}
