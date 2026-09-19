import type { GameEvent } from "../events/types";
import type { CardName } from "../types/game-state";
import type { CardAnimation, Zone } from "../animation/types";
import { uiLogger } from "../lib/logger";

/** The one animation method the driver needs; kept off the animation module so tests need no Vite globals */
export type OpponentAnimator = {
  queueAnimationAsync: (animation: Omit<CardAnimation, "id">) => Promise<void>;
};

const DEFAULT_MS = 200;
const GAIN_MS = 300;
const TRASH_MS = 250;

function opponentZone(
  base: "hand" | "inPlay" | "deck" | "discard" | "setAside",
): "hand-opponent" | "inPlay-opponent" | "deck-opponent" | "discard-opponent" {
  return `${base === "setAside" ? "deck" : base}-opponent`;
}

type Flight = {
  cardName: CardName;
  element: Element | null;
  toZone: Zone;
  duration: number;
  selector: string;
};

function flightFor(event: GameEvent): Flight | null {
  if (event.type === "CARD_PLAYED" && event.sourceIndex !== undefined) {
    const selector = `[data-card-id="hand-opponent-${event.sourceIndex}-${event.card}"]`;
    return {
      cardName: event.card,
      element: document.querySelector(selector),
      toZone: opponentZone("inPlay"),
      duration: DEFAULT_MS,
      selector,
    };
  }
  if (event.type === "CARD_GAINED") {
    const selector = `[data-card-id="supply-${event.card}"]`;
    return {
      cardName: event.card,
      element: document.querySelector(selector),
      toZone: opponentZone(event.to),
      duration: GAIN_MS,
      selector,
    };
  }
  if (event.type === "CARD_TRASHED") {
    const selector = `[data-card-id^="${opponentZone(event.from)}-"][data-card-id$="-${event.card}"]`;
    return {
      cardName: event.card,
      element: document.querySelector(selector),
      toZone: "trash",
      duration: TRASH_MS,
      selector,
    };
  }
  if (event.type === "CARD_RETURNED_TO_HAND") {
    const selector = `[data-card-id^="${opponentZone(event.from)}-"][data-card-id$="-${event.card}"]`;
    return {
      cardName: event.card,
      element: document.querySelector(selector),
      toZone: opponentZone("hand"),
      duration: DEFAULT_MS,
      selector,
    };
  }
  return null;
}

/** Fly the opponent's cards for one batch of events, one after another */
export async function animateOpponentEvents(
  events: readonly GameEvent[],
  animation: OpponentAnimator,
  signal: AbortSignal,
): Promise<void> {
  const flights = events.flatMap(event => {
    const flight = flightFor(event);
    return flight ? [flight] : [];
  });
  await flights.reduce<Promise<void>>(async (previous, flight) => {
    await previous;
    if (signal.aborted) return;
    if (!flight.element) {
      uiLogger.warn("Card element not found for opponent animation", {
        card: flight.cardName,
        toZone: flight.toZone,
        selector: flight.selector,
      });
      return;
    }
    await animation.queueAnimationAsync({
      cardName: flight.cardName,
      fromRect: flight.element.getBoundingClientRect(),
      toZone: flight.toZone,
      duration: flight.duration,
    });
  }, Promise.resolve());
}
