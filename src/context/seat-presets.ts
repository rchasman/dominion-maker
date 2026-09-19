import type { Seats } from "../core/seats";
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

const versus = (opponent: Seats[string]) => (players: PlayerId[]) =>
  Object.fromEntries(
    players.map((id, index) => [id, index === 0 ? HUMAN_SEAT : opponent]),
  );

export const SEAT_PRESETS: Record<SeatPreset, Preset> = {
  rules: {
    name: "Rules bot",
    description: "You against a hard-coded rules bot. No LLM calls are made.",
    players: () => ["human", "ai"],
    seats: versus(HEURISTIC_SEAT),
  },
  hybrid: {
    name: "Hybrid",
    description:
      "You against an LLM seat. Several models vote on every move it makes.",
    players: () => ["human", "ai"],
    seats: versus(DEFAULT_LLM_SEAT),
  },
  watch: {
    name: "Watch",
    description: "Two LLM seats play each other. Sit back and watch.",
    players: () => generateAINames(),
    seats: players =>
      Object.fromEntries(players.map(id => [id, DEFAULT_LLM_SEAT])),
  },
};

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
