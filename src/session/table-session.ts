/**
 * A session owns every piece of client state for one table, as instance
 * signals with a constructor and a destructor. A new session never inherits
 * a previous session's values: they are different Signal objects, and the
 * screen that opens a session disposes it when it unmounts.
 *
 * The shapes here are game-agnostic. Each game adds its own actions on top,
 * the way each game's module plugs into the rooms and the seat driver.
 */

import type { ReadonlySignal } from "@preact/signals";
import type { GameShape } from "../core/game-definition";
import type { ControllerConfig, Seats } from "../core/seats";
import type { LLMLogEntry } from "../core/consensus/types";
import type { GameId } from "../game-ids";
import type { BotConfig, ChatMessageData } from "../partykit/protocol";
import type { PlayerInfoEntry } from "../types/player-info";

type SessionMode = "local" | "multiplayer";

export type SessionPlayer = { id: string; name: string };

/** What the shared shell reads from any session, whichever game it plays */
interface TableSession<G extends GameShape> {
  readonly id: string;
  readonly game: GameId;
  readonly mode: SessionMode;
  /** Null until the table holds a started game */
  readonly state: ReadonlySignal<G["state"] | null>;
  readonly events: ReadonlySignal<G["event"][]>;
  /** Who controls each player */
  readonly seats: ReadonlySignal<Seats>;
  /** Named players; a local table names its seats itself */
  readonly players: ReadonlySignal<SessionPlayer[]>;
  /** Multiplayer only: this client's player id. Local tables derive it from seats. */
  readonly localPlayerId: ReadonlySignal<string | null>;
  /** The seat a human at this client acts for: their own id in a room, else the first human seat */
  readonly localHumanSeat: ReadonlySignal<string | null>;
  readonly isProcessing: ReadonlySignal<boolean>;
  readonly llmLogs: ReadonlySignal<LLMLogEntry[]>;
  readonly chatMessages: ReadonlySignal<ChatMessageData[]>;
  readonly isSpectator: ReadonlySignal<boolean>;
  readonly isHost: ReadonlySignal<boolean>;
  readonly setSeat: (player: string, config: ControllerConfig) => void;
  readonly dispose: () => void;
}

/** A table whose engine runs in this browser and whose bots are driven here */
export interface LocalTable<G extends GameShape> extends TableSession<G> {
  readonly mode: "local";
  /** Reseat the whole table, for the preset switcher */
  readonly setSeats: (seats: Seats) => void;
}

/** A room: the server runs the engine and this client mirrors it over the wire */
export interface RoomTable<G extends GameShape> extends TableSession<G> {
  readonly mode: "multiplayer";
  /** True while the room has sent a state this client's game cannot read */
  readonly unreadable: ReadonlySignal<boolean>;
  readonly playerInfo: ReadonlySignal<Record<string, PlayerInfoEntry> | null>;
  readonly isConnected: ReadonlySignal<boolean>;
  readonly isJoined: ReadonlySignal<boolean>;
  readonly spectatorCount: ReadonlySignal<number>;
  readonly error: ReadonlySignal<string | null>;
  /** Set only when the game permanently ends */
  readonly gameEndReason: ReadonlySignal<string | null>;
  readonly disconnectedPlayers: ReadonlySignal<ReadonlyMap<string, string>>;
  /** The host replays history; the answer arrives as a preview_state message */
  readonly getStateAtEvent: (eventId: string) => Promise<G["state"]>;
  readonly startGame: (
    options?: G["options"],
    bots?: Array<{ name: string; controller: BotConfig }>,
  ) => void;
  readonly resign: () => void;
  readonly sendChat: (content: string) => void;
}
