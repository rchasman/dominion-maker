import type { Seats } from "../core/seats";
import { HEURISTIC_SEAT } from "../core/seats";
import type { SeatPreset } from "../context/seat-presets";
import { versus } from "../context/seat-presets";
import { CHESS_LLM_SEAT } from "./seat";

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
