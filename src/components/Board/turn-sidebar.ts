/**
 * What the shared sidebar asks of a turn-based board game: who the table
 * waits on, which colour that is, and the preset switcher under the game's
 * own names. Each factory closes over the game's definition or tables.
 */

import type { GameDefinition, GameShape } from "../../core/game-definition";
import type { Seats } from "../../core/seats";
import {
  SEAT_PRESET_NAMES,
  presetOf,
  type SeatPreset,
  type TablePreset,
} from "../../core/seat-presets";
import { run } from "../../lib/run";
import type { SidebarPresets } from "./GameSidebarComponents";
import type { TurnStatus } from "./TurnStatusIndicator";

type TurnStatusOf<S> = (
  state: S,
  seats: Seats,
  localPlayerId: string | null,
  isProcessing: boolean,
) => TurnStatus;

/**
 * A bot on the clock reads as thinking; the local human's own turn as theirs.
 * A turn still being processed reads as neither, matching Dominion: the seat
 * is nominally the human's, but the table is not theirs to act on yet.
 */
export const turnStatusFor =
  <G extends GameShape>(game: GameDefinition<G>): TurnStatusOf<G["state"]> =>
  (state, seats, localPlayerId, isProcessing) => {
    const mover = game.whoMustAct(state);
    return run(() => {
      if (mover === null) return null;
      if (mover === localPlayerId) return isProcessing ? null : "yours";
      return seats[mover]?.kind === "human" ? null : "thinking";
    });
  };

/** The mover's colour, by seat order; the secondary text colour once nobody moves */
export const moverColorFor =
  <G extends GameShape>(game: GameDefinition<G>, colours: readonly string[]) =>
  (state: G["state"]): string => {
    const mover = game.whoMustAct(state);
    const index = game.players(state).findIndex(id => id === mover);
    return colours[index] ?? "var(--color-text-secondary)";
  };

/**
 * The same three modes Dominion offers, labelled as the game names them. A
 * room leaves out `onChange`, so the switcher hides itself exactly as it
 * does on Dominion's multiplayer board.
 */
export const presetsFor =
  (table: Record<SeatPreset, Pick<TablePreset, "name">>) =>
  (seats: Seats, onChange?: (preset: SeatPreset) => void): SidebarPresets => ({
    names: SEAT_PRESET_NAMES,
    label: preset => table[preset].name,
    active: presetOf(seats),
    ...(onChange !== undefined && { onChange }),
  });
