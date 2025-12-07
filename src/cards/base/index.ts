/**
 * Event-sourced card effects - each card in its own file
 */

import type { CardName } from "../../types/game-state";
import type { CardEffect } from "../effect-types";

// Import all cards
import { smithy } from "./smithy";
import { village } from "./village";
import { laboratory } from "./laboratory";
import { festival } from "./festival";
import { market } from "./market";
import { councilRoom } from "./council-room";
import { moat } from "./moat";
import { workshop } from "./workshop";
import { remodel } from "./remodel";
import { artisan } from "./artisan";
import { chapel } from "./chapel";
import { moneylender } from "./moneylender";
import { mine } from "./mine";
import { cellar } from "./cellar";
import { militia } from "./militia";
import { witch } from "./witch";
import { bandit } from "./bandit";
import { bureaucrat } from "./bureaucrat";
import { harbinger } from "./harbinger";
import { vassal } from "./vassal";
import { throneRoom } from "./throne-room";
import { merchant } from "./merchant";
import { poacher } from "./poacher";
import { sentry } from "./sentry";
import { library } from "./library";
import { gardens } from "./gardens";

/**
 * Registry of all card effects.
 * Each effect returns events to emit, not mutated state.
 */
export const CARD_EFFECTS: Partial<Record<CardName, CardEffect>> = {
  // $2 Cost
  Cellar: cellar,
  Chapel: chapel,
  Moat: moat,

  // $3 Cost
  Harbinger: harbinger,
  Merchant: merchant,
  Vassal: vassal,
  Village: village,
  Workshop: workshop,

  // $4 Cost
  Bureaucrat: bureaucrat,
  Gardens: gardens,
  Militia: militia,
  Moneylender: moneylender,
  Poacher: poacher,
  Remodel: remodel,
  Smithy: smithy,
  "Throne Room": throneRoom,

  // $5 Cost
  Bandit: bandit,
  "Council Room": councilRoom,
  Festival: festival,
  Laboratory: laboratory,
  Library: library,
  Market: market,
  Mine: mine,
  Sentry: sentry,
  Witch: witch,

  // $6 Cost
  Artisan: artisan,
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
