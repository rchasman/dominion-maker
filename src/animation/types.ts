import type { CardName } from "../types/game-state";

// Zone names - use suffix for opponent zones
export type Zone =
  | "hand"
  | "hand-opponent"
  | "inPlay"
  | "inPlay-opponent"
  | "deck"
  | "deck-opponent"
  | "discard"
  | "discard-opponent"
  | "supply"
  | "trash";

export interface CardAnimation {
  id: string;
  cardName: CardName;
  fromRect: DOMRect;
  toZone: Zone;
  duration: number;
}
