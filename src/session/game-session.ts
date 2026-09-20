/**
 * A game session owns every piece of client game state for one table, as
 * instance signals with a constructor and a destructor. A new session never
 * inherits a previous session's values: they are different Signal objects.
 */

import type { ReadonlySignal } from "@preact/signals";
import type { GameState, CardName } from "../types/game-state";
import type { DecisionChoice, GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { ControllerConfig, Seats } from "../core/seats";
import type { LLMLogEntry } from "../components/LLMLog/types";
import type {
  BotConfig,
  ChatMessageData,
  PlayerInfo,
} from "../partykit/protocol";
import type { PendingUndoRequest } from "../engine/engine";

type SessionMode = "local" | "multiplayer";

export type SessionPlayer = { id: string; name: string };

type SessionBase = {
  readonly id: string;
  readonly mode: SessionMode;
  readonly gameState: ReadonlySignal<GameState | null>;
  readonly events: ReadonlySignal<GameEvent[]>;
  /** Who controls each player */
  readonly seats: ReadonlySignal<Seats>;
  /** Multiplayer only: this client's player id. Local games derive it from seats. */
  readonly localPlayerId: ReadonlySignal<string | null>;
  /** The seat a human at this client acts for: their own id in multiplayer, else the first human seat */
  readonly localHumanSeat: ReadonlySignal<string | null>;
  readonly isProcessing: ReadonlySignal<boolean>;
  readonly isLoading: ReadonlySignal<boolean>;
  readonly llmLogs: ReadonlySignal<LLMLogEntry[]>;
  readonly playerStrategies: ReadonlySignal<PlayerStrategyData>;
  readonly hasPlayableActions: ReadonlySignal<boolean>;
  readonly hasTreasuresInHand: ReadonlySignal<boolean>;
  readonly pendingUndo: ReadonlySignal<PendingUndoRequest | null>;
  /** Named players; empty for a local table, which names seats from game state */
  readonly players: ReadonlySignal<SessionPlayer[]>;
  readonly chatMessages: ReadonlySignal<ChatMessageData[]>;
  readonly spectatorCount: ReadonlySignal<number>;
  readonly isSpectator: ReadonlySignal<boolean>;
  readonly isHost: ReadonlySignal<boolean>;

  readonly playAction: (card: CardName) => CommandResult;
  readonly playTreasure: (card: CardName) => CommandResult;
  readonly unplayTreasure: (card: CardName) => CommandResult;
  readonly playAllTreasures: () => CommandResult;
  readonly buyCard: (card: CardName) => CommandResult;
  readonly endPhase: () => CommandResult;
  readonly submitDecision: (choice: DecisionChoice) => CommandResult;
  readonly revealReaction: (card: CardName) => CommandResult;
  readonly declineReaction: () => CommandResult;
  readonly requestUndo: (toEventId: string) => void;
  readonly approveUndo: (requestId: string) => void;
  readonly denyUndo: (requestId: string) => void;
  readonly setSeat: (player: string, config: ControllerConfig) => void;
  readonly getStateAtEvent: (eventId: string) => GameState | Promise<GameState>;
  readonly dispose: () => void;
};

export type LocalGameSession = Omit<SessionBase, "getStateAtEvent"> & {
  readonly mode: "local";
  readonly getStateAtEvent: (eventId: string) => GameState;
  /** Start a new game at this table, keeping the current seats */
  readonly startGame: () => void;
  /** Reseat the whole table, for the preset switcher */
  readonly setSeats: (seats: Seats) => void;
};

export type RemoteGameSession = Omit<SessionBase, "getStateAtEvent"> & {
  readonly mode: "multiplayer";
  /** The server projects history; the answer arrives as a preview_state message */
  readonly getStateAtEvent: (eventId: string) => Promise<GameState>;
  readonly isConnected: ReadonlySignal<boolean>;
  readonly isJoined: ReadonlySignal<boolean>;
  readonly playerInfos: ReadonlySignal<PlayerInfo[]>;
  readonly error: ReadonlySignal<string | null>;
  /** Set only when the game permanently ends */
  readonly gameEndReason: ReadonlySignal<string | null>;
  readonly disconnectedPlayers: ReadonlySignal<ReadonlyMap<string, string>>;
  readonly startGame: (
    kingdomCards?: CardName[],
    bots?: Array<{ name: string; controller: BotConfig }>,
  ) => void;
  readonly resign: () => void;
  readonly sendChat: (content: string) => void;
};

export type GameSession = LocalGameSession | RemoteGameSession;
