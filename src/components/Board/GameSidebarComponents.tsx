import { lazy, Suspense } from "preact/compat";
import type { GameMode } from "../../types/game-mode";
import { GAME_MODE_CONFIG } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import type { LLMLogEntry } from "../../context/llm-log-context";
import {
  FONT_WEIGHT_NORMAL,
  FONT_WEIGHT_BOLD,
  FULL_PERCENT,
} from "./constants";

const LLMLog = lazy(() =>
  import("../LLMLog").then(m => ({ default: m.LLMLog })),
);

interface GameModeSwitcherProps {
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function GameModeSwitcher({
  gameMode,
  onGameModeChange,
}: GameModeSwitcherProps) {
  return (
    <div style={{ marginBlockEnd: "var(--space-3)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-secondary)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05rem",
          }}
        >
          Mode:
        </span>
        {(["engine", "hybrid", "full"] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onGameModeChange(mode)}
            style={{
              padding: "3px 8px",
              fontSize: "0.65rem",
              fontWeight:
                gameMode === mode ? FONT_WEIGHT_BOLD : FONT_WEIGHT_NORMAL,
              background:
                gameMode === mode ? "var(--color-victory-dark)" : "transparent",
              color: gameMode === mode ? "#fff" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor:
                gameMode === mode
                  ? "var(--color-victory)"
                  : "var(--color-border-secondary)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05rem",
              fontFamily: "inherit",
              borderRadius: "3px",
            }}
          >
            {GAME_MODE_CONFIG[mode].name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface GameActionButtonsProps {
  onNewGame?: () => void;
  onEndGame?: () => void;
  onBackToHome?: () => void;
}

export function GameActionButtons({
  onNewGame,
  onEndGame,
  onBackToHome,
}: GameActionButtonsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        justifyContent: "center",
      }}
    >
      {onNewGame && (
        <button
          onClick={onNewGame}
          style={{
            padding: "var(--space-2) var(--space-3)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontFamily: "inherit",
            borderRadius: "4px",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-1)",
            transition: "color 0.15s",
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.color = "var(--color-action)")
          }
          onMouseLeave={e =>
            (e.currentTarget.style.color = "var(--color-text-secondary)")
          }
          title="New Game"
        >
          <span style={{ fontSize: "0.875rem" }}>⊕</span>
          <span>New Game</span>
        </button>
      )}

      {(onEndGame || onBackToHome) && (
        <button
          onClick={() => {
            const callback = onEndGame || onBackToHome;
            if (callback) {
              callback();
            }
          }}
          style={{
            padding: "var(--space-2) var(--space-3)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontFamily: "inherit",
            borderRadius: "4px",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-1)",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e =>
            (e.currentTarget.style.color = "var(--color-text-secondary)")
          }
          title="End Game"
        >
          <span style={{ fontSize: "0.875rem" }}>⊗</span>
          <span>End Game</span>
        </button>
      )}
    </div>
  );
}

interface LLMLogSectionProps {
  llmLogs: LLMLogEntry[];
  gameMode: GameMode;
  gameLogHeight: number;
  modelSettings?: ModelSettings;
  onModelSettingsChange?: (settings: ModelSettings) => void;
}

function LLMLogFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--color-text-secondary)",
        fontSize: "0.75rem",
      }}
    >
      Loading...
    </div>
  );
}

export function LLMLogSection({
  llmLogs,
  gameMode,
  gameLogHeight,
  modelSettings,
  onModelSettingsChange,
}: LLMLogSectionProps) {
  return (
    <div
      style={{
        height: `${FULL_PERCENT - gameLogHeight}%`,
        minBlockSize: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg-primary)",
        overflow: "hidden",
      }}
    >
      <Suspense fallback={<LLMLogFallback />}>
        <LLMLog
          entries={llmLogs}
          gameMode={gameMode}
          modelSettings={
            modelSettings && onModelSettingsChange
              ? {
                  settings: modelSettings,
                  onChange: onModelSettingsChange,
                }
              : undefined
          }
        />
      </Suspense>
    </div>
  );
}

interface GameControlsSectionProps {
  gameMode: GameMode;
  onGameModeChange?: (mode: GameMode) => void;
  onNewGame?: () => void;
  onEndGame?: () => void;
  onBackToHome?: () => void;
}

export function GameControlsSection({
  gameMode,
  onGameModeChange,
  onNewGame,
  onEndGame,
  onBackToHome,
}: GameControlsSectionProps) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderBlockStart: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
      }}
    >
      {onGameModeChange && (
        <GameModeSwitcher
          gameMode={gameMode}
          onGameModeChange={onGameModeChange}
        />
      )}

      <GameActionButtons
        onNewGame={onNewGame}
        onEndGame={onEndGame}
        onBackToHome={onBackToHome}
      />
    </div>
  );
}
