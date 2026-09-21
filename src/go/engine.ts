import type { CommandResult } from "../core/engine";
import type { EventEngine } from "../core/game-module";
import { run } from "../lib/run";
import {
  finalScore,
  judgePlacement,
  leaderOf,
  pointLabel,
  replayMoves,
  stoneOf,
  type Point,
} from "./rules";
import type {
  GoCommand,
  GoEvent,
  GoGameInitialized,
  GoMoveRecord,
  GoOptions,
  GoPassed,
  GoPlayerId,
  GoPlayerOrder,
  GoResigned,
  GoResult,
  GoScore,
  GoShape,
  GoState,
  GoStonePlaced,
} from "./shape";

type Listener = (events: GoEvent[], state: GoState) => void;

/** A stone or a pass: the acts that fill the move list */
type GoPlay = GoStonePlaced | GoPassed;

const PASSES_TO_END = 2;

const isInitialized = (event: GoEvent): event is GoGameInitialized =>
  event.type === "GAME_INITIALIZED";

const isPlay = (event: GoEvent): event is GoPlay =>
  event.type === "STONE_PLACED" || event.type === "PASSED";

const isResigned = (event: GoEvent): event is GoResigned =>
  event.type === "RESIGNED";

const opponentOf = (
  playerOrder: GoPlayerOrder,
  player: GoPlayerId,
): GoPlayerId => (playerOrder[0] === player ? playerOrder[1] : playerOrder[0]);

/** Whose turn it is by the rules, ignoring whether the game has ended */
const toMove = (playerOrder: GoPlayerOrder, moveCount: number): GoPlayerId =>
  moveCount % 2 === 0 ? playerOrder[0] : playerOrder[1];

/** The player the move count says is to move, whether or not the game has ended */
export const sideToMove = (state: GoState): GoPlayerId =>
  toMove(state.playerOrder, state.moves.length);

const recordOf = (event: GoPlay): GoMoveRecord =>
  event.type === "PASSED" ? "pass" : { x: event.x, y: event.y };

const describe = (event: GoPlay, size: number): string =>
  event.type === "PASSED" ? "a pass" : pointLabel(size, event);

/** How many passes close the move list; two in a row end the game */
const trailingPasses = (moves: readonly GoMoveRecord[]): number =>
  moves.reduce((passes, move) => (move === "pass" ? passes + 1 : 0), 0);

const endedByPasses = (moves: readonly GoMoveRecord[]): boolean =>
  trailingPasses(moves) >= PASSES_TO_END;

/** A resignation decides the game, whatever the board would have scored */
const resultOf = (score: GoScore | null, resignedBy: GoPlayerId | null) =>
  run<GoResult | null>(() => {
    if (resignedBy !== null) return "resignation";
    if (score !== null) return "score";
    return null;
  });

const winnerOf = (
  result: GoResult | null,
  playerOrder: GoPlayerOrder,
  score: GoScore | null,
  resignedBy: GoPlayerId | null,
): GoPlayerId | null =>
  run(() => {
    if (result === "score" && score !== null) {
      const leader = leaderOf(score);
      return leader === null ? null : playerOrder[leader];
    }
    if (result === "resignation" && resignedBy !== null)
      return opponentOf(playerOrder, resignedBy);
    return null;
  });

/** The move list, refusing any play made after two passes closed the game */
const moveListOf = (
  events: readonly GoEvent[],
  playerOrder: GoPlayerOrder,
  size: number,
): GoMoveRecord[] =>
  events.filter(isPlay).reduce<GoMoveRecord[]>((played, event) => {
    const play = describe(event, size);
    if (endedByPasses(played))
      throw new Error(
        `Go log has ${event.playerId} playing ${play} after two passes ended the game`,
      );
    const expected = toMove(playerOrder, played.length);
    if (event.playerId !== expected)
      throw new Error(
        `Go log has ${event.playerId} playing ${play}, but it is ${expected} to move`,
      );
    return [...played, recordOf(event)];
  }, []);

/**
 * The resignation that ends the log, if one does. The engine appends nothing
 * after a RESIGNED and never accepts one once two passes have scored the
 * game, so a log doing either was not written by the engine.
 */
const resignationOf = (
  events: readonly GoEvent[],
  playerOrder: GoPlayerOrder,
  moves: readonly GoMoveRecord[],
  size: number,
): GoResigned | null => {
  const resignation = events.find(isResigned);
  if (resignation === undefined) return null;
  if (!playerOrder.includes(resignation.playerId))
    throw new Error(
      `Go log has a resignation from ${resignation.playerId}, who is not playing`,
    );
  const playedOn = events.slice(events.indexOf(resignation) + 1).find(isPlay);
  if (playedOn)
    throw new Error(
      `Go log has ${playedOn.playerId} playing ${describe(playedOn, size)} after ${resignation.playerId} resigned`,
    );
  if (endedByPasses(moves))
    throw new Error(
      `Go log has ${resignation.playerId} resigning after two passes ended the game`,
    );
  return resignation;
};

/**
 * A log can arrive from a host snapshot, so every mover is checked against the
 * side to move, every stone against the rules, and nothing may follow the
 * end of the game. Without this a RESIGNED from a stranger hands Black the
 * game, and a stone after the final pass rewrites the score.
 */
const projectState = (events: readonly GoEvent[]): GoState => {
  const initialized = events.find(isInitialized);
  if (!initialized)
    throw new Error("A Go log must start with GAME_INITIALIZED");
  const { players: playerOrder, size } = initialized;
  const moves = moveListOf(events, playerOrder, size);
  const replayed = replayMoves(size, moves);
  const resignedBy =
    resignationOf(events, playerOrder, moves, size)?.playerId ?? null;
  const consecutivePasses = trailingPasses(moves);
  const score = endedByPasses(moves) ? finalScore(replayed.board, size) : null;
  const result = resultOf(score, resignedBy);
  return {
    size,
    board: replayed.board,
    playerOrder,
    moves,
    captures: replayed.captures,
    consecutivePasses,
    gameOver: result !== null,
    winnerId: winnerOf(result, playerOrder, score, resignedBy),
    result,
    score,
  };
};

/** Ids are `${firstId}-${index}`, so the prefix is readable back off any log */
const prefixOf = (events: readonly GoEvent[]): string => {
  const first = events[0]?.id;
  if (first === undefined) return crypto.randomUUID();
  return /^(.*)-\d+$/.exec(first)?.[1] ?? first;
};

export class GoEngine implements EventEngine<GoShape> {
  private events: readonly GoEvent[];
  private projection: { state: GoState; length: number } | null = null;
  private readonly listeners = new Set<Listener>();
  private idPrefix: string;

  constructor(events: readonly GoEvent[], idPrefix: string) {
    this.events = events;
    this.idPrefix = idPrefix;
  }

  get state(): GoState {
    const cached = this.projection;
    if (cached && cached.length === this.events.length) return cached.state;
    const fresh = {
      state: projectState(this.events),
      length: this.events.length,
    };
    this.projection = fresh;
    return fresh.state;
  }

  get eventLog(): readonly GoEvent[] {
    return this.events;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  loadEvents(events: GoEvent[]): void {
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

  dispatch(command: GoCommand, actor?: GoPlayerId): CommandResult<GoEvent> {
    const state = this.state;
    const wrongPlayer =
      command.type === "RESIGN" ? "Not your game" : "Not your move";
    if (state.gameOver) return { ok: false, error: "Game is over" };
    if (actor !== undefined && actor !== command.playerId)
      return { ok: false, error: wrongPlayer };
    if (!state.playerOrder.includes(command.playerId))
      return { ok: false, error: wrongPlayer };
    if (command.type === "RESIGN")
      return this.append({ type: "RESIGNED", playerId: command.playerId });
    if (sideToMove(state) !== command.playerId)
      return { ok: false, error: "Not your move" };
    if (command.type === "PASS")
      return this.append({ type: "PASSED", playerId: command.playerId });
    return this.place(state, command.playerId, command);
  }

  private place(
    state: GoState,
    playerId: GoPlayerId,
    point: Point,
  ): CommandResult<GoEvent> {
    const { positions } = replayMoves(state.size, state.moves);
    const judged = judgePlacement(
      state.size,
      state.board,
      positions,
      stoneOf(state.moves.length),
      point,
    );
    if (!judged.ok) {
      const where =
        judged.error === "off the board"
          ? "That point"
          : pointLabel(state.size, point);
      return { ok: false, error: `${where} is ${judged.error}` };
    }
    return this.append({
      type: "STONE_PLACED",
      playerId,
      x: point.x,
      y: point.y,
    });
  }

  private append(event: GoEvent): CommandResult<GoEvent> {
    const withId: GoEvent = {
      ...event,
      id: `${this.idPrefix}-${this.events.length}`,
    };
    this.events = [...this.events, withId];
    this.projection = null;
    this.notify([withId]);
    return { ok: true, events: [withId] };
  }

  private notify(events: GoEvent[]): void {
    const state = this.state;
    for (const listener of this.listeners) listener(events, state);
  }
}

export const createGoGame = (
  players: GoPlayerId[],
  options: GoOptions,
): GoEngine => {
  const [black, white] = players;
  if (black === undefined || white === undefined || players.length !== 2)
    throw new Error("Go is a game for exactly two players");
  const idPrefix = crypto.randomUUID();
  const initialized: GoEvent = {
    type: "GAME_INITIALIZED",
    players: [black, white],
    size: options.size,
    id: `${idPrefix}-0`,
  };
  return new GoEngine([initialized], idPrefix);
};

export const loadGoEngine = (events: readonly GoEvent[]): GoEngine => {
  const engine = new GoEngine([...events], prefixOf(events));
  // A log the room cannot replay must fail here, not on the first read.
  projectState(engine.eventLog);
  return engine;
};
