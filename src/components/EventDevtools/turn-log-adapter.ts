/**
 * The shared event devtools read a turn-based board game's log the same way
 * whatever the game: the scrubber stops on the plays and on a resignation,
 * which are the acts a player takes; the opening event is setup and carries
 * no position of its own. A game supplies only its reading of the events.
 */

import type { GameShape } from "../../core/game-definition";
import type { GameModule } from "../../core/game-module";
import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";

const PLAYS = "moves";
const GAME = "game";

const TURN_LOG_CATEGORIES = [PLAYS, GAME] as const;

const PLAY_COLOUR = "#8b5cf6";
const SETUP_COLOUR = "#22c55e";
const RESIGN_COLOUR = "#dc2626";

export type TurnLogReading<E extends DevtoolsEvent> = {
  isPlay: (event: E) => boolean;
  isResign: (event: E) => boolean;
  /** One label per event of the log, built once so a play can be numbered */
  labels: (events: readonly E[]) => ReadonlyMap<E, string>;
};

/** The position after the first `index + 1` events, replayed here */
export const stateAtFor =
  <G extends GameShape>(module: GameModule<G>) =>
  (events: readonly G["event"][]) =>
  (index: number): G["state"] =>
    module.loadEngine(events.slice(0, index + 1)).state;

export function turnLogAdapter<E extends DevtoolsEvent>(
  reading: TurnLogReading<E>,
  events: readonly E[],
  stateAt: (index: number) => unknown,
): EventDevtoolsAdapter<E> {
  const labels = reading.labels(events);
  return {
    isRoot: event => reading.isPlay(event) || reading.isResign(event),
    label: event => labels.get(event) ?? event.type,
    category: event => (reading.isPlay(event) ? PLAYS : GAME),
    categories: TURN_LOG_CATEGORIES,
    colour: event => {
      if (reading.isPlay(event)) return PLAY_COLOUR;
      return reading.isResign(event) ? RESIGN_COLOUR : SETUP_COLOUR;
    },
    stateAt,
  };
}
