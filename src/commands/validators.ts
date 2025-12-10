import type { GameState, CardName, PlayerId, Phase } from "../types/game-state";
import type { CommandResult } from "./types";
import { isActionCard, isTreasureCard, CARDS } from "../data/cards";

/**
 * Validation result - either success (undefined) or error result
 */
type ValidationResult = CommandResult | undefined;

/**
 * Validator function type
 */
type Validator = () => ValidationResult;

/**
 * Run a series of validators in order, returning the first error or undefined if all pass
 */
export function validateCommand(...validators: Validator[]): ValidationResult {
  return validators.reduce<ValidationResult>((acc, validator) => acc || validator(), null);
}

/**
 * Validators for common command validation patterns
 */
export const validators = {
  /**
   * Validate that the game is in the expected phase
   */
  phase: (state: GameState, expected: Phase): ValidationResult => {
    return state.phase !== expected
      ? { ok: false, error: `Not in ${expected} phase` }
      : undefined;
  },

  /**
   * Validate that the player has at least one action remaining
   */
  hasActions: (state: GameState): ValidationResult => {
    return state.actions < 1
      ? { ok: false, error: "No actions remaining" }
      : undefined;
  },

  /**
   * Validate that the player has at least one buy remaining
   */
  hasBuys: (state: GameState): ValidationResult => {
    return state.buys < 1
      ? { ok: false, error: "No buys remaining" }
      : undefined;
  },

  /**
   * Validate that the player has enough coins
   */
  hasCoins: (state: GameState, required: number): ValidationResult => {
    return state.coins < required
      ? { ok: false, error: "Not enough coins" }
      : undefined;
  },

  /**
   * Validate that a card is an action card
   */
  isAction: (card: CardName): ValidationResult => {
    return !isActionCard(card)
      ? { ok: false, error: "Not an action card" }
      : undefined;
  },

  /**
   * Validate that a card is a treasure card
   */
  isTreasure: (card: CardName): ValidationResult => {
    return !isTreasureCard(card)
      ? { ok: false, error: "Not a treasure card" }
      : undefined;
  },

  /**
   * Validate that a player exists in the game state
   */
  playerExists: (state: GameState, player: PlayerId): ValidationResult => {
    return !state.players[player]
      ? { ok: false, error: "Player not found" }
      : undefined;
  },

  /**
   * Validate that a card is in the player's hand
   */
  cardInHand: (state: GameState, player: PlayerId, card: CardName): ValidationResult => {
    const playerState = state.players[player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }
    return !playerState.hand.includes(card)
      ? { ok: false, error: "Card not in hand" }
      : undefined;
  },

  /**
   * Validate that a card is in the player's in-play area
   */
  cardInPlay: (state: GameState, player: PlayerId, card: CardName): ValidationResult => {
    const playerState = state.players[player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }
    return !playerState.inPlay.includes(card)
      ? { ok: false, error: "Card not in play" }
      : undefined;
  },

  /**
   * Validate that a card exists in the CARDS registry
   */
  cardExists: (card: CardName): ValidationResult => {
    return !CARDS[card]
      ? { ok: false, error: "Unknown card" }
      : undefined;
  },

  /**
   * Validate that a card is available in the supply
   */
  cardInSupply: (state: GameState, card: CardName): ValidationResult => {
    return (state.supply[card] || 0) <= 0
      ? { ok: false, error: "Card not available in supply" }
      : undefined;
  },

  /**
   * Validate that no purchases have been made this turn (for unplay treasure)
   */
  noPurchasesMade: (state: GameState): ValidationResult => {
    const hasMadePurchases = state.turnHistory.some(
      action => action.type === "buy_card",
    );
    return hasMadePurchases
      ? { ok: false, error: "Cannot unplay treasures after already made purchases" }
      : undefined;
  },
};
