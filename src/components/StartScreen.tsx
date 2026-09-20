import {
  SEAT_PRESETS,
  SEAT_PRESET_NAMES,
  type SeatPreset,
} from "../context/seat-presets";
import { CHESS_SEAT_PRESETS } from "../chess/presets";
import type { GameId } from "../game-ids";

type PresetCopy = { name: string; description: string };

const PRESET_COPY: Record<GameId, Record<SeatPreset, PresetCopy>> = {
  dominion: SEAT_PRESETS,
  chess: CHESS_SEAT_PRESETS,
};

const TITLES: Record<GameId, { title: string; subtitle: string }> = {
  dominion: { title: "DOMINION", subtitle: "Base Game" },
  chess: { title: "CHESS", subtitle: "Standard rules" },
};

const GAME_NAMES: Record<GameId, string> = {
  dominion: "Dominion",
  chess: "Chess",
};

const GAME_IDS_IN_ORDER: GameId[] = ["dominion", "chess"];

const FONT_WEIGHT_ACTIVE = 700;
const FONT_WEIGHT_INACTIVE = 400;

interface StartScreenProps {
  game: GameId;
  onGameChange: (game: GameId) => void;
  preset: SeatPreset;
  onPresetChange: (preset: SeatPreset) => void;
  onStartSinglePlayer?: () => void;
  onStartMultiplayer?: () => void;
}

function renderGameButtons(game: GameId, onGameChange: (game: GameId) => void) {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)" }}>
      {GAME_IDS_IN_ORDER.map(id => (
        <ChoiceButton
          key={id}
          label={GAME_NAMES[id]}
          isActive={id === game}
          onClick={() => onGameChange(id)}
        />
      ))}
    </div>
  );
}

function renderPresetButtons(
  game: GameId,
  preset: SeatPreset,
  onPresetChange: (preset: SeatPreset) => void,
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
      {SEAT_PRESET_NAMES.map(name => (
        <ChoiceButton
          key={name}
          label={PRESET_COPY[game][name].name}
          isActive={name === preset}
          onClick={() => onPresetChange(name)}
        />
      ))}
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
  game,
  onGameChange,
  preset,
  onPresetChange,
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
        {TITLES[game].title}
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
        {TITLES[game].subtitle}
      </p>

      {renderGameButtons(game, onGameChange)}

      {renderPresetButtons(game, preset, onPresetChange)}

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
        {PRESET_COPY[game][preset].description}
      </p>

      {renderActionButtons(onStartSinglePlayer, onStartMultiplayer)}
    </div>
  );
}

function ChoiceButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
      {label}
    </button>
  );
}
