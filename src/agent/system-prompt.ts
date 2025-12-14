import { CARDS } from "../data/cards";
import { encodeToon } from "../lib/toon";
import type { CardName } from "../types/game-state";

export function buildCardDefinitionsTable(supply: Record<CardName, number>): string {
  // Only include cards that are in the current game's supply
  const cardsInSupply = Object.keys(supply) as CardName[];

  const cardData = cardsInSupply.map(cardName => {
    const card = CARDS[cardName];
    return {
      name: card.name,
      cost: card.cost,
      types: card.types.join("|"),
      effect: card.description,
      coins: card.coins ?? null,
      vp: card.vp ?? null,
    };
  });

  return encodeToon(cardData);
}

export function buildSystemPrompt(supply: Record<CardName, number>): string {
  return `Data is TOON-encoded (self-documenting, tab-delimited).

You are a Dominion AI. Choose ONE atomic action from LEGAL ACTIONS.

Game structure:
Turn phases: Action → Buy → Cleanup
- Action phase: play actions (cost yourActions), then end_phase
- Buy phase: play treasures (+coins), buy cards (cost yourBuys + yourCoins), then end_phase
- Cleanup: discard everything, draw 5, reset resources to 1/1/0

Resources (yourActions/yourBuys/yourCoins) reset each turn.
- yourActions: only relevant in action phase
- yourBuys/yourCoins: only relevant in buy phase

CRITICAL RULES:
1. NEVER buy Copper - it's the weakest treasure (worth 1 coin). You start with 7 Coppers. Buying more dilutes your deck with weak cards. Buy Silver (3 coins) or Gold (6 coins) instead.
2. ALWAYS play ALL treasures in your hand during buy phase to maximize coins available for purchases.

If STRATEGY OVERRIDE present: follow absolutely.

CARD DEFINITIONS (static reference):
${buildCardDefinitionsTable(supply)}

Note: Current state shows supply counts and effective costs (after reductions).`;
}
