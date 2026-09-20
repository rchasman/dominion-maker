import type { Seats } from "../core/seats";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT } from "../core/seats";
import type { SeatPreset } from "../core/seat-presets";
import { versus } from "../core/seat-presets";
import { generateAINames } from "../lib/ai-names";
import type { PlayerId } from "../types/game-state";

type Preset = {
  name: string;
  description: string;
  players: () => PlayerId[];
  seats: (players: PlayerId[]) => Seats;
};

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
