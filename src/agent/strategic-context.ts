import type { GameState, CardName } from "../types/game-state";
import { CARDS, isActionCard, isTreasureCard, isVictoryCard } from "../data/cards";
import { countVP as countVPFromCards } from "../lib/board-utils";

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
  const supplyEntries = Object.entries(state.supply);
  const lowPiles = supplyEntries
    .filter(([, count]) => count <= 3 && count > 0)
    .map(([card, count]) => `${card}: ${count}`)
    .join(", ");
  const emptyPiles = supplyEntries
    .filter(([, count]) => count === 0)
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

const calculateVP = (deck: CardName[], hand: CardName[], discard: CardName[], inPlay: CardName[]): number =>
  countVPFromCards([...deck, ...hand, ...discard, ...inPlay]);

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

interface DeckAccumulator {
  counts: Record<string, number>;
  treasureValue: number;
  treasureCount: number;
  terminals: number;
  villages: number;
}

function analyzeDeck(cards: CardName[]): DeckAnalysis {
  const initial: DeckAccumulator = { counts: {}, treasureValue: 0, treasureCount: 0, terminals: 0, villages: 0 };
  const { counts, treasureValue, treasureCount, terminals, villages } = cards.reduce(
    (acc, card) => {
      const { coins, description } = CARDS[card];
      const newCounts = { ...acc.counts, [card]: (acc.counts[card] || 0) + 1 };
      const hasTreasure = coins ? { treasureValue: acc.treasureValue + coins, treasureCount: acc.treasureCount + 1 } : {};

      const actionUpdate = isActionCard(card)
        ? description.includes("+2 Actions")
          ? { villages: acc.villages + 1 }
          : !description.includes("+1 Action")
          ? { terminals: acc.terminals + 1 }
          : {}
        : {};

      return {
        ...acc,
        ...hasTreasure,
        ...actionUpdate,
        counts: newCounts,
      };
    },
    initial
  );

  const breakdown = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([card, count]) => `${count} ${card}`)
    .join(", ");

  return {
    treasures: cards.filter(isTreasureCard).length,
    actions: cards.filter(isActionCard).length,
    victory: cards.filter(isVictoryCard).length,
    breakdown,
    totalTreasureValue: treasureValue,
    avgTreasureValue: treasureCount > 0 ? treasureValue / treasureCount : 0,
    terminals,
    villages,
  };
}
