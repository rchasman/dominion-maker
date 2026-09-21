/**
 * The game-agnostic half of a local session: one engine, the signals its
 * state is published into, the seat driver that plays the non-human seats,
 * and the disposer that stops all of it. A game wraps this with its own
 * actions.
 */

import { batch, computed, effect, signal } from "@preact/signals";
import type { ReadonlySignal, Signal } from "@preact/signals";
import type { GameShape } from "../core/game-definition";
import type { EventEngine, GameModule } from "../core/game-module";
import type { Controller } from "../core/controller";
import type { ControllerConfig, Seats } from "../core/seats";
import { firstHumanSeat, withSeat } from "../core/seats";
import type { LLMLogEntry, LLMLogger } from "../core/consensus/types";
import { stampLogEntry } from "../core/consensus/log";
import { createSeatDriver, type SeatAnimation } from "../core/seat-driver";
import type { SessionPlayer } from "./table-session";

type LocalTableParams<G extends GameShape, E extends EventEngine<G>> = {
  module: GameModule<G>;
  engine: E;
  seats: Seats;
  llmLogs: LLMLogEntry[];
  /** Named seats for the selectors; a game that names seats from its state passes none */
  players: SessionPlayer[];
  controllerFor: (
    logger: LLMLogger,
  ) => (
    config: ControllerConfig,
    player: G["playerId"],
  ) => Controller<G> | null;
  animation: SeatAnimation<G> | null;
  stepDelayMs: number;
};

type LocalTableCore<G extends GameShape, E extends EventEngine<G>> = {
  readonly engineRef: { current: E };
  readonly state: Signal<G["state"] | null>;
  readonly events: Signal<G["event"][]>;
  readonly seats: Signal<Seats>;
  readonly players: Signal<SessionPlayer[]>;
  readonly localHumanSeat: ReadonlySignal<string | null>;
  readonly isProcessing: Signal<boolean>;
  readonly llmLogs: Signal<LLMLogEntry[]>;
  /** Stamps each entry with the log length it was written at, so an undo can drop what came after */
  readonly logger: LLMLogger;
  /** Publish the engine's log and state into the signals */
  readonly sync: () => void;
  /** Swap in a fresh engine for a new game at this table */
  readonly replaceEngine: (next: E) => void;
  /** Abort the bot mid-decision; the driver restarts from the next published state */
  readonly interrupt: () => void;
  readonly setSeat: (player: string, config: ControllerConfig) => void;
  readonly setSeats: (seats: Seats) => void;
  readonly dispose: () => void;
};

/** A table's state is null until its engine holds a started game */
const stateOf = <G extends GameShape>(
  engine: EventEngine<G>,
): G["state"] | null => (engine.eventLog.length > 0 ? engine.state : null);

export function createLocalTable<G extends GameShape, E extends EventEngine<G>>(
  params: LocalTableParams<G, E>,
): LocalTableCore<G, E> {
  const { module, controllerFor, animation, stepDelayMs } = params;
  const engineRef = { current: params.engine };

  const state = signal<G["state"] | null>(stateOf(engineRef.current));
  const events = signal<G["event"][]>([...engineRef.current.eventLog]);
  const seats = signal<Seats>(params.seats);
  const players = signal<SessionPlayer[]>(params.players);
  const isProcessing = signal(false);
  const llmLogs = signal<LLMLogEntry[]>(params.llmLogs);

  const localHumanSeat = computed<string | null>(() => {
    const current = state.value;
    const order = current === null ? [] : module.definition.players(current);
    return firstHumanSeat(seats.value, order);
  });

  const sync = () => {
    const engine = engineRef.current;
    batch(() => {
      events.value = [...engine.eventLog];
      state.value = stateOf(engine);
    });
  };

  const logger: LLMLogger = entry => {
    llmLogs.value = [
      ...llmLogs.value,
      {
        ...stampLogEntry(entry),
        data: { ...entry.data, eventCount: engineRef.current.eventLog.length },
      },
    ];
  };

  const driver = createSeatDriver<G>({
    game: module.definition,
    engineRef,
    controllerFor: controllerFor(logger),
    logger,
    animation,
    stepDelayMs,
    onSync: sync,
    getSeats: () => seats.peek(),
    setProcessing: processing => {
      isProcessing.value = processing;
    },
    localPlayerId: () => null,
  });
  const stopDriving = effect(() => {
    driver.update(state.value, seats.value);
  });

  return {
    engineRef,
    state,
    events,
    seats,
    players,
    localHumanSeat,
    isProcessing,
    llmLogs,
    logger,
    sync,
    replaceEngine: next => {
      driver.dispose();
      engineRef.current = next;
      sync();
    },
    interrupt: () => driver.dispose(),
    setSeat: (player, config) => {
      seats.value = withSeat(seats.value, player, config);
    },
    setSeats: next => {
      seats.value = next;
    },
    dispose: () => {
      stopDriving();
      driver.dispose();
    },
  };
}
