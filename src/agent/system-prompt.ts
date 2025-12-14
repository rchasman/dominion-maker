import { CARDS } from "../data/cards";
import { encodeToon } from "../lib/toon";
import type { CardName } from "../types/game-state";

export function buildCardDefinitionsTable(
  supply: Record<CardName, number>,
): string {
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
  return `Dominion: Deck-building game. Win: most VP when game ends (supply piles empty). Bought cards recur in future hands. Build engine first (more coins/actions per turn), score VP later. VP cards score but generate no resources - buying them early weakens your engine.

Turn phases: Action → Buy → Cleanup
- Action: play action cards (costs 1 yourActions per card), then end_phase
- Buy: play treasures FREE (adds coins to yourCoins), buy cards (costs yourBuys + yourCoins), then end_phase
- Cleanup: discard all, draw 5, reset to 1/1/0

Resources reset each cleanup:
- yourActions: play action cards (action phase)
- yourBuys: buy cards (buy phase)
- yourCoins: accumulated by playing treasures, spent buying cards (buy phase)

CARD DEFINITIONS:
${buildCardDefinitionsTable(supply)}

Task: You will receive CURRENT STATE, strategic context, history, and LEGAL ACTIONS. Choose ONE action from LEGAL ACTIONS.
Format: TOON (tab-delimited). If STRATEGY OVERRIDE present: follow it absolutely.`;
}
