/**
 * Standard stage identifiers for card effects.
 * Using constants prevents typos and enables IDE autocomplete.
 */
export const STAGES = {
  TRASH: "trash",
  DISCARD: "discard",
  GAIN: "gain",
  TOPDECK: "topdeck",
  OPPONENT_DISCARD: "opponent_discard",
  VICTIM_TRASH_CHOICE: "victim_trash_choice",
  ON_SKIP: "on_skip",
  REVEAL: "reveal",
  CHOOSE_ACTION: "choose_action",
} as const;

export type Stage = (typeof STAGES)[keyof typeof STAGES];
