import type { GameState } from "../types/game-state";
import { CARDS } from "../data/cards";

export interface ValidationError {
  message: string;
  field?: string;
}

/**
 * Validates that a state transition is legal in Dominion.
 * Returns array of errors (empty if valid).
 */
export function validateStateTransition(
  before: GameState,
  after: GameState
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Skip validation if game just started
  if (before.log.length === 0) {
    return errors;
  }

  const player = before.activePlayer;
  const beforePlayer = before.players[player];
  const afterPlayer = after.players[player];

  // Check that inPlay cards were actually in hand
  const addedToInPlay = afterPlayer.inPlay.filter(
    (_card, idx) => idx >= beforePlayer.inPlay.length
  );

  for (const cardInPlay of addedToInPlay) {
    // Count how many of this card were in hand before
    const inHandBefore = beforePlayer.hand.filter((c) => c === cardInPlay).length;
    const alreadyInPlay = beforePlayer.inPlay.filter((c) => c === cardInPlay).length;
    const nowInPlay = afterPlayer.inPlay.filter((c) => c === cardInPlay).length;

    const playedCount = nowInPlay - alreadyInPlay;

    if (playedCount > inHandBefore) {
      errors.push({
        message: `${player} played ${playedCount}x ${cardInPlay} but only had ${inHandBefore} in hand`,
        field: "inPlay",
      });
    }
  }

  // Check that coins match treasures in play
  if (after.phase === "buy") {
    const treasuresInPlay = afterPlayer.inPlay.filter(
      (card) => card === "Copper" || card === "Silver" || card === "Gold"
    );
    const expectedCoins = treasuresInPlay.reduce((sum, card) => {
      return sum + (CARDS[card].coins || 0);
    }, 0);

    // Allow for some flexibility (cards like Merchant, Festival, etc. add coins)
    // but if coins are way off, flag it
    if (after.coins > expectedCoins + 10) {
      errors.push({
        message: `${player} has $${after.coins} but treasures in play only give $${expectedCoins}`,
        field: "coins",
      });
    }
  }

  // Check that bought cards could be afforded
  const newLogEntries = after.log.slice(before.log.length);
  for (const entry of newLogEntries) {
    if (entry.type === "buy-card") {
      const card = entry.card;
      const cost = CARDS[card]?.cost || 0;

      if (cost > before.coins) {
        errors.push({
          message: `${player} bought ${card} ($${cost}) but only had $${before.coins}`,
          field: "buy",
        });
      }
    }
  }

  // Check that supply counts only decreased (or stayed same)
  for (const card in after.supply) {
    const beforeCount = before.supply[card] || 0;
    const afterCount = after.supply[card] || 0;

    if (afterCount > beforeCount) {
      errors.push({
        message: `Supply[${card}] increased from ${beforeCount} to ${afterCount}`,
        field: "supply",
      });
    }
  }

  return errors;
}
