/**
 * Game action functions extracted from GameContext
 * Pure functions that dispatch commands to the engine
 */

import type { DominionEngine } from "../engine";
import type { PlayerId, CardName, GameState } from "../types/game-state";
import type { DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import { isTreasureCard } from "../data/cards";
import { uiLogger } from "../lib/logger";

/**
 * Play an action card
 */
export function executePlayAction(
  engine: DominionEngine,
  playerId: PlayerId,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "PLAY_ACTION",
      playerId,
      card,
    },
    playerId,
  );
}

/**
 * Play a treasure card
 */
export function executePlayTreasure(
  engine: DominionEngine,
  playerId: PlayerId,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "PLAY_TREASURE",
      playerId,
      card,
    },
    playerId,
  );
}

/**
 * Unplay a treasure card
 */
export function executeUnplayTreasure(
  engine: DominionEngine,
  playerId: PlayerId,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "UNPLAY_TREASURE",
      playerId,
      card,
    },
    playerId,
  );
}

/**
 * Play all treasures in hand
 * Uses reduce for O(n) operation with state tracking
 */
export function executePlayAllTreasures(
  engine: DominionEngine,
  playerId: PlayerId,
  gameState: GameState,
): CommandResult {
  const playerState = gameState.players[playerId];
  if (!playerState) {
    return { ok: false, error: `No such player: ${playerId}` };
  }

  const treasures = playerState.hand.filter(isTreasureCard);

  // Use reduce to track any errors while playing treasures
  const hasError = treasures.reduce((errorOccurred, treasure) => {
    const result = engine.dispatch(
      {
        type: "PLAY_TREASURE",
        playerId,
        card: treasure,
      },
      playerId,
    );

    if (!result.ok) {
      uiLogger.error(`Failed to play ${treasure}`, { error: result.error });
      return true;
    }

    return errorOccurred;
  }, false);

  return hasError
    ? { ok: false, error: "Failed to play one or more treasures" }
    : { ok: true, events: [] };
}

/**
 * Buy a card
 */
export function executeBuyCard(
  engine: DominionEngine,
  playerId: PlayerId,
  card: CardName,
): CommandResult {
  return engine.dispatch(
    {
      type: "BUY_CARD",
      playerId,
      card,
    },
    playerId,
  );
}

/**
 * End current phase
 */
export function executeEndPhase(
  engine: DominionEngine,
  playerId: PlayerId,
): CommandResult {
  return engine.dispatch(
    {
      type: "END_PHASE",
      playerId,
    },
    playerId,
  );
}

/**
 * Submit a decision choice
 */
export function executeSubmitDecision(
  engine: DominionEngine,
  playerId: PlayerId,
  choice: DecisionChoice,
): CommandResult {
  return engine.dispatch(
    {
      type: "SUBMIT_DECISION",
      playerId,
      choice,
    },
    playerId,
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
