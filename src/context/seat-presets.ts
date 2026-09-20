import type { ControllerConfig, Seats } from "../core/seats";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { generateAINames } from "../lib/ai-names";
import type { PlayerId } from "../types/game-state";
import { uiLogger } from "../lib/logger";

export type SeatPreset = "rules" | "hybrid" | "watch";

type Preset = {
  name: string;
  description: string;
  players: () => PlayerId[];
  seats: (players: PlayerId[]) => Seats;
};

/** A table where the first player is the human and everyone else is the opponent */
export const versus =
  (opponent: ControllerConfig) =>
  (players: readonly string[]): Seats =>
    Object.fromEntries(
      players.map((id, index) => [id, index === 0 ? HUMAN_SEAT : opponent]),
    );

export const SEAT_PRESETS: Record<SeatPreset, Preset> = {
  rules: {
    name: "Engine",
    description: "Hard-coded rules engine with simple random AI",
    players: () => ["human", "ai"],
    seats: versus(HEURISTIC_SEAT),
  },
  hybrid: {
    name: "Hybrid",
    description:
      "Human vs AI - AI opponent uses MAKER consensus voting (multiple models vote on each decision)",
    players: () => ["human", "ai"],
    seats: versus(DEFAULT_LLM_SEAT),
  },
  watch: {
    name: "Full",
    description: "AI vs AI - Watch both players use MAKER consensus voting",
    players: () => generateAINames(),
    seats: players =>
      Object.fromEntries(players.map(id => [id, DEFAULT_LLM_SEAT])),
  },
};

/** The preset a table matches, for the sidebar switcher; null for a mixed table */
export function presetOf(seats: Seats): SeatPreset | null {
  const kinds = Object.values(seats).map(seat => seat.kind);
  if (kinds.length === 0) return null;
  const humans = kinds.filter(kind => kind === "human").length;
  if (humans === 0) return kinds.every(kind => kind === "llm") ? "watch" : null;
  if (humans !== 1) return null;
  const others = kinds.filter(kind => kind !== "human");
  if (others.every(kind => kind === "heuristic")) return "rules";
  if (others.every(kind => kind === "llm")) return "hybrid";
  return null;
}

/** Every preset, in the order every game's switcher shows them */
export const SEAT_PRESET_NAMES = Object.keys(SEAT_PRESETS).filter(
  (name): name is SeatPreset => name in SEAT_PRESETS,
);

const SEAT_PRESET_STORAGE_KEY = "dominion-maker-seat-preset";

const isPreset = (value: string | null): value is SeatPreset =>
  value !== null && value in SEAT_PRESETS;

export function loadSeatPreset(): SeatPreset {
  try {
    const saved = localStorage.getItem(SEAT_PRESET_STORAGE_KEY);
    return isPreset(saved) ? saved : "rules";
  } catch {
    return "rules";
  }
}

export function saveSeatPreset(preset: SeatPreset): void {
  try {
    localStorage.setItem(SEAT_PRESET_STORAGE_KEY, preset);
  } catch (error) {
    uiLogger.warn("Could not save seat preset", { error });
  }
}
