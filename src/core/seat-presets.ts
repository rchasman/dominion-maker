/**
 * The preset vocabulary every game shares: the three table shapes, the rule
 * that reads a table back as one of them, and the stored choice. Each game
 * keeps its own table of names, descriptions and seats.
 */

import type { ControllerConfig, Seats } from "./seats";
import { HUMAN_SEAT } from "./seats";
import { uiLogger } from "../lib/logger";

export type SeatPreset = "rules" | "hybrid" | "watch";

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
