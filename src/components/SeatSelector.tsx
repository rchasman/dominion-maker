import type { ControllerConfig, ControllerKind } from "../core/seats";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { settingsSeat$ } from "../context/game-signals";

const KINDS: ReadonlyArray<{ kind: ControllerKind; label: string }> = [
  { kind: "human", label: "Human" },
  { kind: "heuristic", label: "Rules bot" },
  { kind: "llm", label: "LLM" },
];

const isKind = (value: string): value is ControllerKind =>
  KINDS.some(entry => entry.kind === value);

interface SeatSelectorProps {
  playerId: string;
  config: ControllerConfig;
  onChange: (config: ControllerConfig) => void;
  disabled?: boolean;
}

/** Who plays this seat. Picking LLM opens that seat's model settings. */
export function SeatSelector({
  playerId,
  config,
  onChange,
  disabled = false,
}: SeatSelectorProps) {
  const handleChange = (event: Event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement) || !isKind(target.value)) {
      return;
    }
    const kind = target.value;
    if (kind === "human") onChange(HUMAN_SEAT);
    if (kind === "heuristic") onChange(HEURISTIC_SEAT);
    if (kind === "llm") {
      onChange(config.kind === "llm" ? config : DEFAULT_LLM_SEAT);
      settingsSeat$.value = playerId;
    }
  };

  return (
    <select
      className="seat-selector"
      aria-label={`Controller for ${playerId}`}
      value={config.kind}
      onChange={handleChange}
      disabled={disabled}
    >
      {KINDS.map(entry => (
        <option key={entry.kind} value={entry.kind}>
          {entry.label}
        </option>
      ))}
    </select>
  );
}
