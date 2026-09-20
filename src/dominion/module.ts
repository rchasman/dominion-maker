import { z } from "zod";
import type { EventEngine, GameModule } from "../core/game-module";
import { DEFAULT_LLM_SEAT, isHumanSeat } from "../core/seats";
import { DominionEngine, createGame } from "../engine";
import { cardsSchema, gameStateSchema } from "../validation/game-state";
import { gameEventSchema } from "../validation/events";
import { roomCommandSchema } from "../validation/commands";
import { actionSchema } from "../validation/action";
import { multiplayerLogger } from "../lib/logger";
import { dominionGame } from "./definition";
import type { DominionOptions, DominionShape } from "./shape";
import { playerView, publicEvents } from "./view";

const optionsSchema: z.ZodType<DominionOptions> = z
  .object({ kingdomCards: cardsSchema.optional(), seed: z.number().optional() })
  .strict();

const loadEngine = (
  events: readonly DominionShape["event"][],
): EventEngine<DominionShape> => {
  const engine = new DominionEngine();
  engine.loadEvents([...events]);
  return engine;
};

export const dominionModule: GameModule<DominionShape> = {
  name: "Dominion",
  definition: dominionGame,
  createEngine: (players, options) =>
    createGame(players, options.kingdomCards, options.seed),
  loadEngine,
  eventSchema: gameEventSchema,
  commandSchema: roomCommandSchema,
  stateSchema: gameStateSchema,
  moveSchema: actionSchema,
  optionsSchema,
  view: playerView,
  publicEvents,
  needsFullResync: events => events.some(e => e.type === "UNDO_EXECUTED"),
  afterCommand: (engine, events, seats) => {
    const requested = events.find(event => event.type === "UNDO_REQUESTED");
    if (!requested) return;
    Object.entries(seats)
      .filter(([, seat]) => !isHumanSeat(seat))
      .map(([playerId]) => ({
        playerId,
        result: engine.dispatch({
          type: "APPROVE_UNDO",
          playerId,
          requestId: requested.requestId,
        }),
      }))
      .filter(({ result }) => !result.ok)
      .map(({ playerId, result }) =>
        multiplayerLogger.warn(
          `Bot ${playerId} could not approve undo ${requested.requestId}: ${result.ok ? "" : result.error}`,
        ),
      );
  },
  defaultLlmSeat: DEFAULT_LLM_SEAT,
};
