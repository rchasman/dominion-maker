import type { GameDefinition, GameShape, EngineOf } from "./game-definition";
import type { Controller } from "./controller";
import type { ControllerConfig, Seats } from "./seats";
import { isHumanSeat } from "./seats";

const MIN_RETRY_DELAY_MS = 500;

export type DriveOptions<G extends GameShape> = {
  game: GameDefinition<G>;
  getSeats: () => Seats<G["playerId"]>;
  controllerFor: (
    config: ControllerConfig,
    player: G["playerId"],
  ) => Controller<G> | null;
  onStep?: (events: readonly G["event"][]) => void | Promise<void>;
  stepDelayMs: number;
  /** Tests pass 0; production keeps the 500 ms floor between retries */
  minRetryDelayMs?: number;
  signal: AbortSignal;
  logError?: (message: string) => void;
};

const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  ms <= 0 || signal.aborted
    ? Promise.resolve()
    : new Promise(resolve => {
        const done = () => {
          signal.removeEventListener("abort", done);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, ms);
        signal.addEventListener("abort", done);
      });

type Decided<C> =
  | { command: C; error: null }
  | { command: null; error: unknown };

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Drive every non-human seat until a human must act, the game ends, or the
 * signal aborts. A decision made against a log that changed while deciding
 * is discarded, never dispatched. Rejected dispatches retry forever, loudly.
 */
export async function driveEngine<G extends GameShape>(
  engine: EngineOf<G>,
  opts: DriveOptions<G>,
): Promise<void> {
  const { game, getSeats, controllerFor, onStep, stepDelayMs, signal } = opts;
  const logError =
    opts.logError ?? ((message: string) => console.error(message));
  const retryDelay = Math.max(
    stepDelayMs,
    opts.minRetryDelayMs ?? MIN_RETRY_DELAY_MS,
  );

  const step = async (failures: number): Promise<void> => {
    if (signal.aborted) return;
    const player = game.whoMustAct(engine.state);
    if (player === null) return;
    const config = getSeats()[player];
    if (config === undefined || isHumanSeat(config)) return;
    const controller = controllerFor(config, player);
    if (!controller) return;

    const lengthBefore = engine.eventLog.length;
    const decided: Decided<G["command"]> = await controller
      .decide(engine, player, signal)
      .then(
        command => ({ command, error: null }),
        (error: unknown) => ({ command: null, error }),
      );
    if (signal.aborted) return;

    if (decided.error !== null) {
      logError(
        `${player}: decide failed: ${describeError(decided.error)} (failure ${failures + 1})`,
      );
      await wait(retryDelay, signal);
      return step(failures + 1);
    }
    if (engine.eventLog.length !== lengthBefore) return step(failures);

    const result = engine.dispatch(decided.command, player);
    if (!result.ok) {
      logError(
        `${player}: ${JSON.stringify(decided.command)} rejected: ${result.error} (failure ${failures + 1})`,
      );
      await wait(retryDelay, signal);
      return step(failures + 1);
    }
    await onStep?.(result.events);
    await wait(stepDelayMs, signal);
    return step(0);
  };

  await step(0);
}
