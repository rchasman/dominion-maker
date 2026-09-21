/**
 * Who may reseat whom, and with what, on any game's board. Boards ask for
 * the local seat only: bots are reseated through the sidebar presets. Single
 * player: you are always the human, so your own seat shows no selector. A
 * room: your seat shows Manual or LLM (Engine stays a single-player option),
 * editable only when it is yours, so a spectator's borrowed view stays read-only.
 */
import type { VNode } from "preact";
import type {
  ControllerConfig,
  ControllerKind,
  LlmSeatConfig,
  Seats,
} from "../../core/seats";
import { HUMAN_SEAT, isHumanSeat } from "../../core/seats";
import { SeatSelector } from "../SeatSelector";

export type SeatTable =
  | { mode: "local"; seats: Seats }
  | { mode: "room"; seats: Seats; localPlayerId: string | null };

const seatOptionsFor = (table: SeatTable): readonly ControllerKind[] =>
  table.mode === "local" ? ["heuristic", "llm"] : ["human", "llm"];

const showsSelector = (table: SeatTable, playerId: string): boolean =>
  table.mode === "room" || !isHumanSeat(table.seats[playerId]);

const canEditSeat = (table: SeatTable, playerId: string): boolean =>
  table.mode === "local" || playerId === table.localPlayerId;

/** The selector for one seat, or null where that seat shows none */
export type SeatControl = (playerId: string) => VNode | null;

/** Preview mode and spectators reseat nobody */
export const NO_SEAT_CONTROL: SeatControl = () => null;

export const seatControlFor =
  ({
    table,
    defaultLlm,
    setSeat,
    disabled = false,
  }: {
    table: SeatTable;
    defaultLlm: LlmSeatConfig;
    setSeat: (player: string, config: ControllerConfig) => void;
    /** The whole table is read-only, as while a room is disconnected */
    disabled?: boolean;
  }): SeatControl =>
  playerId =>
    showsSelector(table, playerId) ? (
      <SeatSelector
        playerId={playerId}
        config={table.seats[playerId] ?? HUMAN_SEAT}
        options={seatOptionsFor(table)}
        defaultLlm={defaultLlm}
        onChange={config => setSeat(playerId, config)}
        disabled={disabled || !canEditSeat(table, playerId)}
      />
    ) : null;
