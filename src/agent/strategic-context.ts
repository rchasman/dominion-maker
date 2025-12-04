import type { GameState, CardName } from "../types/game-state";
import { CARDS, isActionCard, isTreasureCard, isVictoryCard } from "../data/cards";

/**
 * Builds human-readable game facts that a real Dominion player would track.
 * Pure data - no strategy advice.
 */
export function buildStrategicContext(state: GameState): string {
  const sections: string[] = [];
  const ai = state.players.ai;
  const human = state.players.human;

  // 1. VP Scoreboard
  const aiVP = calculateVP(ai.deck, ai.hand, ai.discard, ai.inPlay);
  const humanVP = calculateVP(human.deck, human.hand, human.discard, human.inPlay);
  const vpDiff = aiVP - humanVP;

  sections.push(`SCORE: You ${aiVP} VP, Opponent ${humanVP} VP (${vpDiff >= 0 ? "+" : ""}${vpDiff})`);

  // 2. Your Deck Composition
  const aiAllCards = [...ai.deck, ...ai.hand, ...ai.discard, ...ai.inPlay];
  const aiAnalysis = analyzeDeck(aiAllCards);

  sections.push(`YOUR DECK (${aiAllCards.length} cards): ${aiAnalysis.breakdown}
Treasure value: $${aiAnalysis.totalTreasureValue} in ${aiAnalysis.treasures} cards (avg $${aiAnalysis.avgTreasureValue.toFixed(1)})
Terminals: ${aiAnalysis.terminals}, Villages: ${aiAnalysis.villages}`);

  // 3. Shuffle Status
  sections.push(`DRAW PILE: ${ai.deck.length} cards | DISCARD: ${ai.discard.length} cards`);

  // 4. Supply Status - only show relevant piles
  const provincesLeft = state.supply["Province"] ?? 8;
  const duchiesLeft = state.supply["Duchy"] ?? 8;
  const lowPiles = Object.entries(state.supply)
    .filter(([_, count]) => count <= 3 && count > 0)
    .map(([card, count]) => `${card}: ${count}`)
    .join(", ");
  const emptyPiles = Object.entries(state.supply)
    .filter(([_, count]) => count === 0)
    .map(([card]) => card)
    .join(", ");

  sections.push(`SUPPLY: Province ${provincesLeft}/8, Duchy ${duchiesLeft}/8${lowPiles ? ` | Low: ${lowPiles}` : ""}${emptyPiles ? ` | Empty: ${emptyPiles}` : ""}`);

  // 5. Opponent Deck
  const humanAllCards = [...human.deck, ...human.hand, ...human.discard, ...human.inPlay];
  const humanAnalysis = analyzeDeck(humanAllCards);

  sections.push(`OPPONENT DECK (${humanAllCards.length} cards): ${humanAnalysis.breakdown}`);

  // 6. Current Hand (during AI turn)
  if (state.activePlayer === "ai") {
    const treasures = ai.hand.filter(c => isTreasureCard(c));
    const treasureValue = treasures.reduce((sum, c) => sum + (CARDS[c].coins || 0), 0);
    const maxCoins = state.coins + treasureValue;

    sections.push(`HAND: ${ai.hand.join(", ")}
Unplayed treasures: $${treasureValue} | Max coins this turn: $${maxCoins}`);
  }

  return sections.join("\n");
}

function calculateVP(deck: CardName[], hand: CardName[], discard: CardName[], inPlay: CardName[]): number {
  const allCards = [...deck, ...hand, ...discard, ...inPlay];
  let vp = 0;

  for (const card of allCards) {
    const def = CARDS[card];
    if (def.vp === "variable") {
      // Gardens: 1 VP per 10 cards
      vp += Math.floor(allCards.length / 10);
    } else if (typeof def.vp === "number") {
      vp += def.vp;
    }
  }

  return vp;
}

interface DeckAnalysis {
  treasures: number;
  actions: number;
  victory: number;
  breakdown: string;
  totalTreasureValue: number;
  avgTreasureValue: number;
  terminals: number;
  villages: number;
}

function analyzeDeck(cards: CardName[]): DeckAnalysis {
  const counts: Record<string, number> = {};
  let treasureValue = 0;
  let treasureCount = 0;
  let terminals = 0;
  let villages = 0;

  for (const card of cards) {
    counts[card] = (counts[card] || 0) + 1;
    const def = CARDS[card];

    if (def.coins) {
      treasureValue += def.coins;
      treasureCount++;
    }

    if (isActionCard(card)) {
      if (def.description.includes("+2 Actions")) {
        villages++;
      } else if (!def.description.includes("+1 Action")) {
        terminals++;
      }
    }
  }

  const breakdown = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([card, count]) => `${count} ${card}`)
    .join(", ");

  return {
    treasures: cards.filter(c => isTreasureCard(c)).length,
    actions: cards.filter(c => isActionCard(c)).length,
    victory: cards.filter(c => isVictoryCard(c)).length,
    breakdown,
    totalTreasureValue: treasureValue,
    avgTreasureValue: treasureCount > 0 ? treasureValue / treasureCount : 0,
    terminals,
    villages,
  };
}
