/**
 * What the event devtools need from a game, and nothing more. One adapter per
 * game teaches the panel to read that game's log; the panel itself knows no
 * event type, no colour per type and no state shape.
 */

/** An event-sourced log entry, whatever the game */
export interface DevtoolsEvent {
  id?: string | undefined;
  type: string;
  /** The event this one answers to, where the game tracks causality */
  causedBy?: string | undefined;
}

export interface EventDevtoolsAdapter<E extends DevtoolsEvent = DevtoolsEvent> {
  /** The scrubber steps root to root: one stop per player action */
  isRoot(event: E): boolean;
  label(event: E): string;
  /** The filter chip this event answers to */
  category(event: E): string;
  /** The chips shown beside "all", in order */
  categories: readonly string[];
  colour(event: E): string;
  /**
   * State after the first `index + 1` events, or a promise of it where only
   * the host can replay the log. Absent where a game offers no state view.
   */
  stateAt?: ((index: number) => unknown) | undefined;
}
