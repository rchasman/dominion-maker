import { lazy, Suspense } from "preact/compat";
import type { ControllerConfig, Seats } from "../../core/seats";
import type { LLMLogEntry } from "../LLMLog";
import {
  FONT_WEIGHT_NORMAL,
  FONT_WEIGHT_BOLD,
  FULL_PERCENT,
} from "./constants";
import type { SeatPreset } from "../../context/seat-presets";

/** The table shapes a game offers, and which one the current table matches */
export interface SidebarPresets {
  names: readonly SeatPreset[];
  label: (preset: SeatPreset) => string;
  active: SeatPreset | null;
  /** Omitted where the table is not this client's to reseat */
  onChange?: (preset: SeatPreset) => void;
}

interface GameModeSwitcherProps {
  names: readonly SeatPreset[];
  label: (preset: SeatPreset) => string;
  activePreset: SeatPreset | null;
  onPresetChange: (preset: SeatPreset) => void;
}

/** Engine / Hybrid / Full: reseat the whole table in one click */
export function GameModeSwitcher({
  names,
  label,
  activePreset,
  onPresetChange,
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
        {names.map(preset => {
          const isActive = activePreset === preset;
          return (
            <button
              key={preset}
              onClick={() => onPresetChange(preset)}
              style={{
                padding: "3px 8px",
                fontSize: "0.65rem",
                fontWeight: isActive ? FONT_WEIGHT_BOLD : FONT_WEIGHT_NORMAL,
                background: isActive
                  ? "var(--color-victory-dark)"
                  : "transparent",
                color: isActive ? "#fff" : "var(--color-text-secondary)",
                border: "1px solid",
                borderColor: isActive
                  ? "var(--color-victory)"
                  : "var(--color-border-secondary)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.05rem",
                fontFamily: "inherit",
                borderRadius: "3px",
              }}
            >
              {label(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const LLMLog = lazy(() =>
  import("../LLMLog").then(m => ({ default: m.LLMLog })),
);

interface GameActionButtonsProps {
  onNewGame?: () => void;
  onEndGame?: () => void;
  onBackToHome?: () => void;
  isSpectator?: boolean;
}

export function GameActionButtons({
  onNewGame,
  onEndGame,
  onBackToHome,
  isSpectator = false,
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
          title={isSpectator ? "Leave Game" : "End Game"}
        >
          <span style={{ fontSize: "0.875rem" }}>⊗</span>
          <span>{isSpectator ? "Leave Game" : "End Game"}</span>
        </button>
      )}
    </div>
  );
}

interface LLMLogSectionProps {
  llmLogs: LLMLogEntry[];
  seats: Seats;
  gameLogHeight: number;
  onSeatChange?: (player: string, config: ControllerConfig) => void;
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
  seats,
  gameLogHeight,
  onSeatChange,
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
          seats={seats}
          {...(onSeatChange !== undefined && { onSeatChange })}
        />
      </Suspense>
    </div>
  );
}

interface GameControlsSectionProps {
  presets: SidebarPresets;
  onNewGame?: () => void;
  onEndGame?: () => void;
  onBackToHome?: () => void;
  isSpectator?: boolean;
}

export function GameControlsSection({
  presets,
  onNewGame,
  onEndGame,
  onBackToHome,
  isSpectator = false,
}: GameControlsSectionProps) {
  const onPresetChange = presets.onChange;
  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderBlockStart: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
      }}
    >
      {!isSpectator && onPresetChange && (
        <GameModeSwitcher
          names={presets.names}
          label={presets.label}
          activePreset={presets.active}
          onPresetChange={onPresetChange}
        />
      )}

      <GameActionButtons
        {...(!isSpectator && onNewGame !== undefined && { onNewGame })}
        {...(!isSpectator && onEndGame !== undefined && { onEndGame })}
        {...(onBackToHome !== undefined && { onBackToHome })}
        isSpectator={isSpectator}
      />
    </div>
  );
}
