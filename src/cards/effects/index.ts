/**
 * Event-based card effects registry.
 * Maps card names to their effect functions.
 */

import type { CardEffect } from "../effect-types";
import type { CardName } from "../../types/game-state";

// Simple cards (no decisions)
import { smithy, village, laboratory, festival, market, councilRoom, moat } from "./simple";

// Decision cards (single or multi-stage)
import { workshop, remodel, artisan, chapel, moneylender, mine } from "./decision";

// Attack and multi-stage cards
import { cellar, militia, witch, bandit, bureaucrat } from "./attack";

// Miscellaneous unique mechanics
import { harbinger, vassal, throneRoom, merchant, poacher, sentry, library, gardens } from "./misc";

/**
 * Registry of all card effects.
 * Each effect returns events to emit, not mutated state.
 */
export const CARD_EFFECTS: Partial<Record<CardName, CardEffect>> = {
  // Simple
  Smithy: smithy,
  Village: village,
  Laboratory: laboratory,
  Festival: festival,
  Market: market,
  "Council Room": councilRoom,
  Moat: moat,

  // Decision
  Workshop: workshop,
  Remodel: remodel,
  Artisan: artisan,
  Chapel: chapel,
  Moneylender: moneylender,
  Mine: mine,

  // Attack / Multi-stage
  Cellar: cellar,
  Militia: militia,
  Witch: witch,
  Bandit: bandit,
  Bureaucrat: bureaucrat,

  // Misc
  Harbinger: harbinger,
  Vassal: vassal,
  "Throne Room": throneRoom,
  Merchant: merchant,
  Poacher: poacher,
  Sentry: sentry,
  Library: library,
  Gardens: gardens,
};

/**
 * Get the effect for a card, or undefined if not implemented.
 */
export function getCardEffect(card: CardName): CardEffect | undefined {
  return CARD_EFFECTS[card];
}

/**
 * Check if a card has an event-based effect implemented.
 */
export function hasCardEffect(card: CardName): boolean {
  return card in CARD_EFFECTS;
}
