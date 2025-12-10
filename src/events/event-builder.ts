import type { GameEvent } from "./types";
import { generateEventId } from "./id-generator";

/**
 * EventBuilder - Manages event causality tracking
 *
 * Removes manual ID threading boilerplate from handlers by automatically:
 * - Generating unique IDs for all events
 * - Linking events to their root cause via causedBy
 * - Supporting nested causality chains (sub-events caused by other sub-events)
 *
 * Usage:
 * ```typescript
 * const builder = new EventBuilder();
 * builder.add({ type: "CARD_PLAYED", player, card });
 * builder.add({ type: "ACTIONS_MODIFIED", delta: -1 });
 * return { ok: true, events: builder.build() };
 * ```
 */
export class EventBuilder {
  private events: GameEvent[] = [];
  private rootEventId: string;

  /**
   * Create a new EventBuilder.
   * @param rootEventId - Optional explicit root event ID. If not provided, generates a new one.
   */
  constructor(rootEventId?: string) {
    this.rootEventId = rootEventId || generateEventId();
  }

  /**
   * Add an event to the chain.
   * The first event added becomes the root cause (no causedBy).
   * Subsequent events are caused by the root event.
   *
   * @param event - Event to add (without id or causedBy)
   * @param causedBy - Optional override for causedBy (defaults to root event ID for non-root events)
   * @returns The event with generated ID for reference
   */
  add<T extends Omit<GameEvent, "id" | "causedBy">>(
    event: T,
    causedBy?: string,
  ): GameEvent {
    const isFirstEvent = this.events.length === 0;
    const eventWithMetadata: GameEvent = {
      ...event,
      id: isFirstEvent ? this.rootEventId : generateEventId(),
      causedBy: isFirstEvent ? undefined : causedBy || this.rootEventId,
    };

    this.events = [...this.events, eventWithMetadata];
    return eventWithMetadata;
  }

  /**
   * Add multiple events caused by the same cause.
   *
   * @param events - Events to add
   * @param causedBy - Optional override for causedBy (defaults to root event ID)
   */
  addAll<T extends Omit<GameEvent, "id" | "causedBy">>(
    events: T[],
    causedBy?: string,
  ): void {
    events.map(event => this.add(event, causedBy));
  }

  /**
   * Get the root event ID for this chain.
   * Useful for passing to nested builders or metadata.
   */
  getRootId(): string {
    return this.rootEventId;
  }

  /**
   * Get the last added event's ID.
   * Useful for creating sub-chains where subsequent events are caused by a middle event.
   */
  getLastId(): string | undefined {
    return this.events[this.events.length - 1]?.id;
  }

  /**
   * Build and return the final event array.
   */
  build(): GameEvent[] {
    return this.events;
  }

  /**
   * Check if any events have been added.
   */
  isEmpty(): boolean {
    return this.events.length === 0;
  }

  /**
   * Merge events from another builder into this one.
   * All events from the other builder will be added with their existing IDs and causedBy links.
   *
   * @param other - Another EventBuilder to merge from
   */
  merge(other: EventBuilder): void {
    this.events = [...this.events, ...other.build()];
  }
}

/**
 * Helper to link events from card effects to a root cause.
 * Maps events without IDs to events with generated IDs and causedBy links.
 *
 * @param events - Events from card effect (typically without id/causedBy)
 * @param causedBy - The event ID that caused these events
 */
export function linkEvents(
  events: Array<Omit<GameEvent, "id" | "causedBy">>,
  causedBy: string,
): GameEvent[] {
  return events.map(event => ({
    ...event,
    id: generateEventId(),
    causedBy,
  })) as GameEvent[];
}
