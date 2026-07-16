import type { CardName } from "../types/game-state";
import type { Zone as GameZone } from "../events/types";

// Rendering zones: the logical game zones, plus -opponent variants for
// the per-player zones so animations can target the opponent's side
type PerPlayerZone = "hand" | "inPlay" | "deck" | "discard";
export type Zone = GameZone | `${PerPlayerZone}-opponent`;

export interface CardAnimation {
  id: string;
  cardName: CardName;
  fromRect: DOMRect;
  toZone: Zone;
  duration: number;
}
