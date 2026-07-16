import type { CardName } from "./basic-types";

export type CardType =
  | "treasure"
  | "victory"
  | "curse"
  | "action"
  | "attack"
  | "reaction";

export type ReactionTrigger =
  | "on_attack"
  | "on_gain"
  | "on_trash"
  | "on_discard";

export type TriggerType =
  | "treasure_played"
  | "card_gained"
  | "card_trashed"
  | "card_discarded";

export type TriggerContext = {
  card: CardName;
  isFirstOfType?: boolean;
  treasuresInPlay?: CardName[];
};
