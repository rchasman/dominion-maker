import type {
  ControllerConfig,
  ControllerKind,
  LlmSeatConfig,
} from "../core/seats";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import {
  gameState$,
  players$,
  rememberedLlm$,
  settingsSeat$,
} from "../context/game-signals";
import { formatPlayerName } from "../lib/board-utils";

const LABELS: Record<ControllerKind, string> = {
  human: "Manual",
  heuristic: "Engine",
  llm: "LLM",
};

const isKind = (value: string): value is ControllerKind => value in LABELS;

/** Every kind a seat can hold, for a table with no seat it hides */
export const DEFAULT_SEAT_OPTIONS: readonly ControllerKind[] = [
  "human",
  "heuristic",
  "llm",
];

interface SeatSelectorProps {
  playerId: string;
  config: ControllerConfig;
  /** Which kinds this table offers: no Engine in a lobby room, no Manual in single player */
  options: readonly ControllerKind[];
  /** The roster a brand new LLM seat starts with, from the game being played */
  defaultLlm: LlmSeatConfig;
  onChange: (config: ControllerConfig) => void;
  disabled?: boolean;
}

/** Who plays this seat. Picking LLM restores the seat's last roster and opens its settings. */
export function SeatSelector({
  playerId,
  config,
  options,
  defaultLlm,
  onChange,
  disabled = false,
}: SeatSelectorProps) {
  const gameState = gameState$.value;
  const displayName =
    players$.value.find(p => p.id === playerId)?.name ??
    formatPlayerName(playerId, false, {
      ...(gameState !== null && { gameState }),
    });

  const handleChange = (event: Event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement) || !isKind(target.value)) {
      return;
    }
    const kind = target.value;
    if (config.kind === "llm" && kind !== "llm") {
      rememberedLlm$.value = { ...rememberedLlm$.value, [playerId]: config };
    }
    if (kind === "human") onChange(HUMAN_SEAT);
    if (kind === "heuristic") onChange(HEURISTIC_SEAT);
    if (kind === "llm") {
      onChange(
        config.kind === "llm"
          ? config
          : (rememberedLlm$.value[playerId] ?? defaultLlm),
      );
      settingsSeat$.value = playerId;
    }
  };

  return (
    <select
      className="seat-selector"
      aria-label={`Controller for ${displayName}`}
      value={config.kind}
      onChange={handleChange}
      disabled={disabled}
    >
      {options.map(kind => (
        <option key={kind} value={kind}>
          {LABELS[kind]}
        </option>
      ))}
    </select>
  );
}
