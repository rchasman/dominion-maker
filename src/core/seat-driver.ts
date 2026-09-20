import type { EngineOf, GameDefinition, GameShape } from "./game-definition";
import type { Controller } from "./controller";
import type { ControllerConfig, Seats } from "./seats";
import type { LLMLogger } from "./consensus/types";
import { isHumanSeat, sameConfig } from "./seats";
import { driveEngine } from "./driver";
import { uiLogger } from "../lib/logger";

type Running = { abort: AbortController; config: ControllerConfig };

/** What the app plays for the events of one step; the signal cuts a flight short */
export type SeatAnimation<G extends GameShape> = {
  play(events: readonly G["event"][], signal: AbortSignal): Promise<void>;
};

type SeatDriver<G extends GameShape> = {
  /** Call with every state or seats change; starts, keeps or aborts the driver */
  update(state: G["state"] | null, seats: Seats<G["playerId"]>): void;
  dispose(): void;
};

type SeatDriverParams<G extends GameShape> = {
  game: GameDefinition<G>;
  engineRef: { current: EngineOf<G> | null };
  controllerFor: (
    config: ControllerConfig,
    player: G["playerId"],
  ) => Controller<G> | null;
  logger: LLMLogger;
  animation?: SeatAnimation<G> | null;
  stepDelayMs: number;
  /** The app writes the engine's log and state wherever its UI reads them */
  onSync: (events: readonly G["event"][], state: G["state"]) => void;
  getSeats: () => Seats<G["playerId"]>;
  setProcessing: (processing: boolean) => void;
  localPlayerId: () => string | null;
};

const actingPlayer = (event: object): string | null => {
  if (!("playerId" in event)) return null;
  const { playerId } = event;
  return typeof playerId === "string" ? playerId : null;
};

const forOtherPlayers = <E extends { id?: string | undefined }>(
  events: readonly E[],
  localPlayerId: string | null,
): E[] =>
  events.filter(event => {
    const actor = actingPlayer(event);
    return actor === null || actor !== localPlayerId;
  });

/**
 * Starts one driver whenever a non-human seat must act, aborts it when that
 * seat becomes human or its config changes, and animates each step.
 * Pure of any UI framework so it can be tested without a DOM.
 */
export function createSeatDriver<G extends GameShape>(
  params: SeatDriverParams<G>,
): SeatDriver<G> {
  const {
    game,
    engineRef,
    controllerFor,
    logger,
    stepDelayMs,
    onSync,
    getSeats,
    setProcessing,
    localPlayerId,
  } = params;
  const animation = params.animation ?? null;
  const running: { current: Running | null } = { current: null };

  const stop = () => {
    running.current?.abort.abort();
    running.current = null;
    setProcessing(false);
  };

  return {
    update(state, seats) {
      const engine = engineRef.current;
      if (!engine || state === null) return;
      const player = game.whoMustAct(state);
      const config = player === null ? undefined : seats[player];

      const current = running.current;
      if (current) {
        const stillValid =
          config !== undefined &&
          !isHumanSeat(config) &&
          sameConfig(config, current.config);
        if (stillValid) return;
        stop();
      }
      if (player === null || config === undefined || isHumanSeat(config)) {
        return;
      }

      const abort = new AbortController();
      running.current = { abort, config };
      setProcessing(true);
      void driveEngine(engine, {
        game,
        getSeats,
        controllerFor,
        onStep: async events => {
          if (animation) {
            await animation.play(
              forOtherPlayers(events, localPlayerId()),
              abort.signal,
            );
          }
          if (!abort.signal.aborted) onSync(engine.eventLog, engine.state);
        },
        stepDelayMs,
        signal: abort.signal,
        logError: message => {
          uiLogger.error(message);
          logger({
            type: "consensus-step-error",
            message,
            data: { error: message },
          });
        },
      }).finally(() => {
        if (running.current?.abort !== abort) return;
        running.current = null;
        setProcessing(false);
        onSync(engine.eventLog, engine.state);
      });
    },
    dispose: stop,
  };
}
