/**
 * The preset vocabulary every game shares: the three table shapes, the rule
 * that reads a table back as one of them, and the stored choice. Each game
 * keeps its own table of names, descriptions and seats.
 */

import type { ControllerConfig, LlmSeatConfig, Seats } from "./seats";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "./seats";
import { uiLogger } from "../lib/logger";

export type SeatPreset = "rules" | "hybrid" | "watch";

/** One table shape as a game names, describes and seats it */
export type TablePreset = {
  name: string;
  description: string;
  seats: (players: readonly string[]) => Seats;
};

/** Every preset, in the order every game's switcher shows them */
export const SEAT_PRESET_NAMES: readonly SeatPreset[] = [
  "rules",
  "hybrid",
  "watch",
];

/** A table where the first player is the human and everyone else is the opponent */
export const versus =
  (opponent: ControllerConfig) =>
  (players: readonly string[]): Seats =>
    Object.fromEntries(
      players.map((id, index) => [id, index === 0 ? HUMAN_SEAT : opponent]),
    );

/**
 * The three presets a two-colour board game offers, under the same names
 * Dominion uses so one switcher serves every game. The first colour is
 * always the seat a human takes.
 */
export const twoColourPresets = (
  humanColourName: string,
  llmSeat: LlmSeatConfig,
): Record<SeatPreset, TablePreset> => ({
  rules: {
    name: "Engine",
    description: `Play ${humanColourName} against the rules bot`,
    seats: versus(HEURISTIC_SEAT),
  },
  hybrid: {
    name: "Hybrid",
    description: `Play ${humanColourName} against MAKER consensus voting`,
    seats: versus(llmSeat),
  },
  watch: {
    name: "Full",
    description: "Watch two consensus voters play each other",
    seats: players => Object.fromEntries(players.map(id => [id, llmSeat])),
  },
});

/**
 * A restored game keeps the table it was played on. A fresh one takes the
 * chosen preset, so picking a preset on the start screen always applies.
 * A stored table that does not seat every player belongs to another game,
 * so it is ignored either way.
 */
export function seatsFor({
  presets,
  players,
  restored,
  saved,
  preset,
}: {
  presets: Record<SeatPreset, TablePreset>;
  players: readonly string[];
  restored: boolean;
  saved: Seats | null;
  preset: SeatPreset;
}): Seats {
  const usable =
    saved !== null && players.every(id => id in saved) ? saved : null;
  if (restored && usable !== null) return usable;
  return presets[preset].seats(players);
}

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

const SEAT_PRESET_STORAGE_KEY = "dominion-maker-seat-preset";

const isPreset = (value: string | null): value is SeatPreset =>
  SEAT_PRESET_NAMES.some(name => name === value);

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
