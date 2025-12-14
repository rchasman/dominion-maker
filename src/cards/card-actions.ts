import type { CardAction } from "../types/game-state";

/**
 * Standard card action definitions shared across all cards.
 */
export const CARD_ACTIONS = {
  topdeck_card: {
    id: "topdeck_card" as const,
    label: "Topdeck",
    color: "#10B981",
  },
  trash_card: {
    id: "trash_card" as const,
    label: "Trash",
    color: "#EF4444",
  },
  discard_card: {
    id: "discard_card" as const,
    label: "Discard",
    color: "#9CA3AF",
  },
  gain_card: {
    id: "gain_card" as const,
    label: "Gain",
    color: "#6366F1",
  },
  draw_card: {
    id: "draw_card" as const,
    label: "Draw",
    color: "#10B981",
  },
} satisfies Record<string, CardAction>;
