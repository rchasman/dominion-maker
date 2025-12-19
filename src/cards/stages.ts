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
  OPPONENT_TOPDECK: "opponent_topdeck",
  VICTIM_TRASH_CHOICE: "victim_trash_choice",
  CHOOSE_ACTION: "choose_action",
  PLAY_ACTION: "play_action",
  EXECUTE_THRONED_CARD: "execute_throned_card",
} as const;

export type Stage = (typeof STAGES)[keyof typeof STAGES];
