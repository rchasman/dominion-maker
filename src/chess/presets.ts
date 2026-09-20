import type { Seats } from "../core/seats";
import { HEURISTIC_SEAT } from "../core/seats";
import type { SeatPreset } from "../core/seat-presets";
import { versus } from "../core/seat-presets";
import { CHESS_LLM_SEAT, CHESS_PLAYERS } from "./seat";

type ChessPreset = {
  name: string;
  description: string;
  seats: (players: readonly string[]) => Seats;
};

/**
 * The same three presets Dominion offers, so one switcher serves both games.
 * White is always the seat a human takes.
 */
export const CHESS_SEAT_PRESETS: Record<SeatPreset, ChessPreset> = {
  rules: {
    name: "Engine",
    description: "Play White against the rules bot",
    seats: versus(HEURISTIC_SEAT),
  },
  hybrid: {
    name: "Hybrid",
    description: "Play White against MAKER consensus voting",
    seats: versus(CHESS_LLM_SEAT),
  },
  watch: {
    name: "Full",
    description: "Watch two consensus voters play each other",
    seats: players =>
      Object.fromEntries(players.map(id => [id, CHESS_LLM_SEAT])),
  },
};

/**
 * A restored game keeps the table it was played on. A fresh one takes the
 * chosen preset, so picking a preset on the start screen always applies.
 * A stored table that does not name both colours is not a chess table, so it
 * is ignored either way.
 */
export function chessSeats(
  restored: boolean,
  saved: Seats | null,
  preset: SeatPreset,
): Seats {
  const usable =
    saved !== null && CHESS_PLAYERS.every(id => id in saved) ? saved : null;
  if (restored && usable !== null) return usable;
  return CHESS_SEAT_PRESETS[preset].seats(CHESS_PLAYERS);
}
