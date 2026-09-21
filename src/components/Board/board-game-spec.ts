/**
 * What a turn-based board game hands the shared local table and room
 * screens: its board, its log rows, its colours and players, its presets,
 * its reading of its own log for the devtools, and (for a local table) its
 * saved game. The screens derive the sidebar and devtools glue from that
 * data themselves, and own everything else: preview mode, the scrubber,
 * storage effects, the room chrome.
 */

import type { ComponentChildren, VNode } from "preact";
import type { GameShape } from "../../core/game-definition";
import type { EventEngine, GameModule } from "../../core/game-module";
import type { SeatPreset, TablePreset } from "../../core/seat-presets";
import type { GameStorage } from "../../session/game-storage";
import type { DevtoolsEvent } from "../EventDevtools/adapter";
import type { TurnLogReading } from "../EventDevtools/turn-log-adapter";
import type { SeatControl } from "./seat-control";

/** A game whose events the devtools can read */
export type BoardShape = GameShape & { event: DevtoolsEvent };

/** What the screens hand the game's board; `session` carries the game's own verbs */
type BoardArgs<G extends BoardShape, S> = {
  session: S;
  state: G["state"];
  /** The seat this client plays; null for a spectator or an all-bot table */
  localPlayerId: string | null;
  /** Player ids read as names where a room names them; empty on a local table */
  playerNames: Record<string, string>;
  disabled: boolean;
  /** The selector each player header shows; the screen decides who may reseat whom */
  seatControl: SeatControl;
  onTakeBack?: () => void;
  onResign?: () => void;
};

export interface BoardGameSpec<G extends BoardShape, S> {
  module: GameModule<G>;
  board: (args: BoardArgs<G, S>) => VNode;
  log: (state: G["state"]) => ComponentChildren;
  logEntryCount: (state: G["state"]) => number;
  /** One colour per player, in seat order, for the mover indicator */
  colours: readonly string[];
  /** Player ids in the order the engine seats them */
  players: readonly string[];
  presets: Record<SeatPreset, TablePreset>;
  logReading: TurnLogReading<G["event"]>;
  /** Local tables only */
  storage: GameStorage<G["event"], EventEngine<G>>;
}
