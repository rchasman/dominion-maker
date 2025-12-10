/**
 * Game action functions extracted from GameContext
 * Pure functions that dispatch commands to the engine
 */

import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import type { DecisionChoice, GameEvent } from "../events/types";
import type { CommandResult } from "../commands/types";
import { isTreasureCard } from "../data/cards";
import { uiLogger } from "../lib/logger";

/**
 * Result of a game action that updates state
 */
export interface GameActionResult {
  success: boolean;
  events: GameEvent[];
  state: GameState;
}

/**
 * Play an action card
 */
export function executePlayAction(
  engine: DominionEngine,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "PLAY_ACTION",
      player: "human",
      card,
    },
    "human",
  );
}

/**
 * Play a treasure card
 */
export function executePlayTreasure(
  engine: DominionEngine,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "PLAY_TREASURE",
      player: "human",
      card,
    },
    "human",
  );
}

/**
 * Unplay a treasure card
 */
export function executeUnplayTreasure(
  engine: DominionEngine,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "UNPLAY_TREASURE",
      player: "human",
      card,
    },
    "human",
  );
}

/**
 * Play all treasures in hand
 * Uses reduce for O(n) operation with state tracking
 */
export function executePlayAllTreasures(
  engine: DominionEngine,
  gameState: GameState,
): CommandResult {
  const humanState = gameState.players.human;
  if (!humanState) {
    return { ok: false, error: "No human player" };
  }

  const treasures = humanState.hand.filter(isTreasureCard);

  // Use reduce to track any errors while playing treasures
  const hasError = treasures.reduce((errorOccurred, treasure) => {
    const result = engine.dispatch(
      {
        type: "PLAY_TREASURE",
        player: "human",
        card: treasure,
      },
      "human",
    );

    if (!result.ok) {
      uiLogger.error(`Failed to play ${treasure}`, { error: result.error });
      return true;
    }

    return errorOccurred;
  }, false);

  return { ok: !hasError, events: [] };
}

/**
 * Buy a card
 */
export function executeBuyCard(
  engine: DominionEngine,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "BUY_CARD",
      player: "human",
      card,
    },
    "human",
  );
}

/**
 * End current phase
 */
export function executeEndPhase(engine: DominionEngine): CommandResult {
  return engine.dispatch(
    {
      type: "END_PHASE",
      player: "human",
    },
    "human",
  );
}

/**
 * Submit a decision choice
 */
export function executeSubmitDecision(
  engine: DominionEngine,
  choice: DecisionChoice,
): CommandResult {
  return engine.dispatch(
    {
      type: "SUBMIT_DECISION",
      player: "human",
      choice,
    },
    "human",
  );
}

/**
 * Undo to a specific event
 */
export function executeUndo(engine: DominionEngine, toEventId: string): void {
  engine.undoToEvent(toEventId);
}

/**
 * Get state at a specific event
 */
export function getStateAtEvent(
  engine: DominionEngine,
  eventId: string,
  fallbackState: GameState,
): GameState {
  return engine.getStateAtEvent(eventId) ?? fallbackState;
}
