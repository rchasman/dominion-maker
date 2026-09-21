import { Chess } from "chess.js";
import type { CommandResult } from "../core/engine";
import type { EventEngine } from "../core/game-module";
import { run } from "../lib/run";
import type {
  ChessCommand,
  ChessEvent,
  ChessGameInitialized,
  ChessMoved,
  ChessPlayerId,
  ChessPlayerOrder,
  ChessResigned,
  ChessResult,
  ChessShape,
  ChessState,
} from "./shape";

type Listener = (events: ChessEvent[], state: ChessState) => void;

const isInitialized = (event: ChessEvent): event is ChessGameInitialized =>
  event.type === "GAME_INITIALIZED";

const isMoved = (event: ChessEvent): event is ChessMoved =>
  event.type === "MOVE";

const isResigned = (event: ChessEvent): event is ChessResigned =>
  event.type === "RESIGNED";

const opponentOf = (
  playerOrder: ChessPlayerOrder,
  player: ChessPlayerId,
): ChessPlayerId =>
  playerOrder[0] === player ? playerOrder[1] : playerOrder[0];

/** Whose turn it is by the rules, ignoring whether the game has ended */
const toMove = (playerOrder: ChessPlayerOrder, board: Chess): ChessPlayerId =>
  playerOrder[board.turn() === "w" ? 0 : 1];

/** The player the FEN says is to move, whether or not the game has ended */
export const sideToMove = (state: ChessState): ChessPlayerId =>
  toMove(state.playerOrder, new Chess(state.fen));

/** The move number a game record shows: both sides' plies share one number */
export const moveNumberOf = (state: ChessState): number =>
  Math.floor(state.moves.length / 2) + 1;

const resultOf = (board: Chess, resignedBy: ChessPlayerId | null) =>
  run<ChessResult | null>(() => {
    if (board.isCheckmate()) return "checkmate";
    if (board.isStalemate()) return "stalemate";
    if (board.isDraw()) return "draw";
    if (resignedBy !== null) return "resignation";
    return null;
  });

const winnerOf = (
  result: ChessResult | null,
  playerOrder: ChessPlayerOrder,
  board: Chess,
  resignedBy: ChessPlayerId | null,
): ChessPlayerId | null =>
  run(() => {
    // The side left to move is the one that was mated.
    if (result === "checkmate")
      return opponentOf(playerOrder, toMove(playerOrder, board));
    if (result === "resignation" && resignedBy !== null)
      return opponentOf(playerOrder, resignedBy);
    return null;
  });

/**
 * A log can arrive from a host snapshot, so every mover is checked against the
 * side to move. Without this a RESIGNED from a stranger hands white the game.
 */
const projectState = (events: readonly ChessEvent[]): ChessState => {
  const initialized = events.find(isInitialized);
  if (!initialized)
    throw new Error("A chess log must start with GAME_INITIALIZED");
  const playerOrder = initialized.players;
  const board = new Chess();
  const moves = events.filter(isMoved).map(event => {
    const expected = toMove(playerOrder, board);
    if (event.playerId !== expected)
      throw new Error(
        `Chess log has ${event.playerId} playing ${event.san}, but it is ${expected} to move`,
      );
    board.move(event.san);
    return event.san;
  });
  const resignation = events.find(isResigned);
  if (resignation && !playerOrder.includes(resignation.playerId))
    throw new Error(
      `Chess log has a resignation from ${resignation.playerId}, who is not playing`,
    );
  const resignedBy = resignation?.playerId ?? null;
  const result = resultOf(board, resignedBy);
  return {
    fen: board.fen(),
    playerOrder,
    moves,
    gameOver: result !== null,
    winnerId: winnerOf(result, playerOrder, board, resignedBy),
    result,
    inCheck: board.inCheck(),
  };
};

/** Ids are `${firstId}-${index}`, so the prefix is readable back off any log */
const prefixOf = (events: readonly ChessEvent[]): string => {
  const first = events[0]?.id;
  if (first === undefined) return crypto.randomUUID();
  return /^(.*)-\d+$/.exec(first)?.[1] ?? first;
};

export class ChessEngine implements EventEngine<ChessShape> {
  private events: readonly ChessEvent[];
  private projection: { state: ChessState; length: number } | null = null;
  private readonly listeners = new Set<Listener>();
  private idPrefix: string;

  constructor(events: readonly ChessEvent[], idPrefix: string) {
    this.events = events;
    this.idPrefix = idPrefix;
  }

  get state(): ChessState {
    const cached = this.projection;
    if (cached && cached.length === this.events.length) return cached.state;
    const fresh = {
      state: projectState(this.events),
      length: this.events.length,
    };
    this.projection = fresh;
    return fresh.state;
  }

  get eventLog(): readonly ChessEvent[] {
    return this.events;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  loadEvents(events: ChessEvent[]): void {
    this.events = [...events];
    this.idPrefix = prefixOf(this.events);
    this.projection = null;
    this.notify([...this.events]);
  }

  /** Rewinds to the first `count` events, for the local Take back button */
  truncateTo(count: number): void {
    this.events = this.events.slice(0, count);
    this.projection = null;
    this.notify([...this.events]);
  }

  dispatch(
    command: ChessCommand,
    actor?: ChessPlayerId,
  ): CommandResult<ChessEvent> {
    const state = this.state;
    const wrongPlayer =
      command.type === "MOVE" ? "Not your move" : "Not your game";
    if (state.gameOver) return { ok: false, error: "Game is over" };
    if (actor !== undefined && actor !== command.playerId)
      return { ok: false, error: wrongPlayer };
    if (!state.playerOrder.includes(command.playerId))
      return { ok: false, error: wrongPlayer };
    if (command.type === "RESIGN")
      return this.append({ type: "RESIGNED", playerId: command.playerId });
    return this.move(state, command.playerId, command.san);
  }

  private move(
    state: ChessState,
    playerId: ChessPlayerId,
    san: string,
  ): CommandResult<ChessEvent> {
    const board = new Chess(state.fen);
    if (toMove(state.playerOrder, board) !== playerId)
      return { ok: false, error: "Not your move" };
    try {
      const played = board.move(san);
      return this.append({ type: "MOVE", playerId, san: played.san });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Illegal move",
      };
    }
  }

  private append(event: ChessEvent): CommandResult<ChessEvent> {
    const withId: ChessEvent = {
      ...event,
      id: `${this.idPrefix}-${this.events.length}`,
    };
    this.events = [...this.events, withId];
    this.projection = null;
    this.notify([withId]);
    return { ok: true, events: [withId] };
  }

  private notify(events: ChessEvent[]): void {
    const state = this.state;
    for (const listener of this.listeners) listener(events, state);
  }
}

export const createChessGame = (players: ChessPlayerId[]): ChessEngine => {
  const [white, black] = players;
  if (white === undefined || black === undefined || players.length !== 2)
    throw new Error("Chess is a game for exactly two players");
  const idPrefix = crypto.randomUUID();
  const initialized: ChessEvent = {
    type: "GAME_INITIALIZED",
    players: [white, black],
    id: `${idPrefix}-0`,
  };
  return new ChessEngine([initialized], idPrefix);
};

export const loadChessEngine = (events: readonly ChessEvent[]): ChessEngine => {
  const engine = new ChessEngine([...events], prefixOf(events));
  // A log the room cannot replay must fail here, not on the first read.
  projectState(engine.eventLog);
  return engine;
};
