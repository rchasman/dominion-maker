import type { z } from "zod";
import type { EngineOf, GameDefinition, GameShape } from "./game-definition";
import type { LlmSeatConfig, Seats } from "./seats";

/** An engine that can be listened to and restored from a log */
export interface EventEngine<G extends GameShape> extends EngineOf<G> {
  subscribe(
    listener: (events: G["event"][], state: G["state"]) => void,
  ): () => void;
  loadEvents(events: G["event"][]): void;
}

/**
 * Everything the rooms and the browser shell need to run one game:
 * the decision rules, an engine, wire schemas and a privacy view.
 */
export interface GameModule<G extends GameShape> {
  name: string;
  definition: GameDefinition<G>;
  /** A fresh game for these players; options are the game's own, validated by optionsSchema */
  createEngine(players: G["playerId"][], options: G["options"]): EventEngine<G>;
  /** Restore from a log: room sync, storage, and history preview (a prefix of the log) */
  loadEngine(events: readonly G["event"][]): EventEngine<G>;
  eventSchema: z.ZodType<G["event"]>;
  commandSchema: z.ZodType<G["command"]>;
  stateSchema: z.ZodType<G["state"]>;
  moveSchema: z.ZodType<G["move"]>;
  optionsSchema: z.ZodType<G["options"]>;
  /** What one viewer may see; identity for perfect-information games */
  view(
    state: G["state"],
    events: readonly G["event"][],
    viewerId: string | null,
  ): G["state"];
  publicEvents(events: readonly G["event"][]): G["event"][];
  /** True when clients must replace their log instead of appending */
  needsFullResync(events: readonly G["event"][]): boolean;
  /** Runs on the server after an accepted command */
  afterCommand?(
    engine: EventEngine<G>,
    events: readonly G["event"][],
    seats: Seats,
  ): void;
  /** The LLM roster a new LLM seat starts with */
  defaultLlmSeat: LlmSeatConfig;
}
