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
  return `Dominion: Deck-building game. Win: most VP when game ends (supply piles empty). Bought cards recur in future hands. Build engine first (more coins/actions per turn), score VP later.

Turn phases: Action → Buy → Cleanup (current phase is you.currentPhase)
- Action: play action cards from you.currentHand (costs 1 you.currentActions per card), then end_phase
- Buy: THREE STEPS IN ORDER:
  1. Play ALL treasures from you.currentTreasuresInHand (if any remain, you MUST play one)
  2. Buy cards from supply (only after currentTreasuresInHand is empty)
  3. End phase
- Cleanup: discard all, draw 5, reset to 1/1/0

Resources reset each cleanup (found in "you" object):
- currentActions: spend to play action cards
- currentBuys: spend to buy cards
- currentCoins: accumulated by playing treasures, spent buying cards

STARTING DECK: 7 Copper (1 coin each) + 3 Estate (0 coins, 1 VP each) = 10 cards.

DECISION FRAMEWORK:
When buying, ask "what's the BEST card I can afford?" not "what can I afford?"
- Treasure hierarchy: Gold (+3) > Silver (+2) > Copper (+1). Higher always dominates lower when affordable.
- Copper trap: You START with 7 Copper. Check you.currentDeckComposition - buying more dilutes your deck for minimal gain. Almost never buy Copper.
- Skip the buy: Determine affordable cards (supply where cost ≤ you.currentCoins). If only Copper/Curse/Estate are affordable, END THE PHASE. Buying junk makes your deck worse. Not buying > buying junk.
- Victory timing: Estate/Duchy clog hands without helping you buy. Only buy VP when:
  (a) You can afford Province ($8 for 6 VP) - the only efficient VP card (or Province pile empty, then buy Duchy)
  (b) Game ending soon (check supply - when 3+ piles at ≤2 cards, game ends)
- Dilution math: A 10-card deck draws 5 cards/turn. Adding weak cards reduces your average hand quality.
- Action cards: Evaluate by deck improvement. +Cards/+Actions compound. Terminals (no +Action) compete for your 1 action/turn.

CARD DEFINITIONS:
${buildCardDefinitionsTable(supply)}

Task: Given CURRENT STATE and strategic context, determine the single best action. Derive valid actions from turn phases, card types, and current resources.

CRITICAL BUY PHASE RULE: Check you.currentTreasuresInHand first. If it contains cards, you MUST output {type: "play_treasure", card: <one from currentTreasuresInHand>}. Only when currentTreasuresInHand is empty can you buy or end phase.

VALIDATION: Only reference cards that exist in your zones:
- play_action/play_treasure: card must be in you.currentHand
- buy_card: card must be in supply with cost ≤ you.currentCoins

If STRATEGY OVERRIDE present: follow it absolutely.`;
}
