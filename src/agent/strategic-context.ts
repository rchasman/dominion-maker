import type { GameState, CardName, LogEntry } from "../types/game-state";
import {
  CARDS,
  isActionCard,
  isTreasureCard,
  isVictoryCard,
} from "../data/cards";
import { countVP as countVPFromCards } from "../lib/board-utils";

/**
 * Extracts recent turn actions from game log for strategy analysis
 */
interface TurnSummary {
  player: string;
  turn: number;
  actionsPlayed: CardName[];
  treasuresPlayed: CardName[];
  cardsBought: CardName[];
}

function extractRecentTurns(log: LogEntry[], lastNTurns = 3): TurnSummary[] {
  const turnMap = new Map<string, TurnSummary>();
  let currentTurn = 0;
  let currentPlayer = "";

  for (const entry of log) {
    if (entry.type === "turn-start") {
      currentTurn = entry.turn;
      currentPlayer = entry.player;
      const key = `${currentPlayer}-${currentTurn}`;
      if (!turnMap.has(key)) {
        turnMap.set(key, {
          player: currentPlayer,
          turn: currentTurn,
          actionsPlayed: [],
          treasuresPlayed: [],
          cardsBought: [],
        });
      }
    }

    if (currentTurn === 0) continue;

    const key = `${entry.player || currentPlayer}-${currentTurn}`;
    const summary = turnMap.get(key);
    if (!summary) continue;

    if (entry.type === "play-action" && entry.card) {
      summary.actionsPlayed.push(entry.card);
    } else if (entry.type === "play-treasure" && entry.card) {
      summary.treasuresPlayed.push(entry.card);
    } else if (entry.type === "buy-card" && entry.card) {
      summary.cardsBought.push(entry.card);
    }
  }

  const allSummaries = Array.from(turnMap.values()).sort(
    (a, b) => b.turn - a.turn,
  );
  return allSummaries.slice(0, lastNTurns * 2);
}

/**
 * Formats turn history for LLM analysis
 */
export function formatTurnHistoryForAnalysis(state: GameState): string {
  const recentTurns = extractRecentTurns(state.log, 3);

  if (recentTurns.length === 0) {
    return "";
  }

  const lines: string[] = ["RECENT TURN HISTORY:"];

  for (const turn of recentTurns) {
    const actions =
      turn.actionsPlayed.length > 0 ? turn.actionsPlayed.join(", ") : "none";
    const buys =
      turn.cardsBought.length > 0 ? turn.cardsBought.join(", ") : "none";

    lines.push(`Turn ${turn.turn} (${turn.player}):`);
    lines.push(`  Actions played: ${actions}`);
    lines.push(`  Bought: ${buys}`);
  }

  return lines.join("\n");
}

interface PlayerStrategyAnalysis {
  strategy: string;
  execution: string;
  position: string;
  weakness: string;
  threats: string;
  nextMove: string;
}

/**
 * Builds human-readable game facts that a real Dominion player would track.
 * Pure data - no strategy advice.
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
): string {
  const sections: string[] = [];

  // Get the current active player (the AI making the decision)
  const currentPlayer = state.players[state.activePlayer];

  // Get the opponent (the other player)
  const opponentId = Object.keys(state.players).find(
    id => id !== state.activePlayer,
  ) as keyof typeof state.players;
  const opponent = state.players[opponentId];

  // 1. VP Scoreboard
  const currentVP = calculateVP(
    currentPlayer.deck,
    currentPlayer.hand,
    currentPlayer.discard,
    currentPlayer.inPlay,
  );
  const opponentVP = calculateVP(
    opponent.deck,
    opponent.hand,
    opponent.discard,
    opponent.inPlay,
  );
  const vpDiff = currentVP - opponentVP;

  sections.push(
    `SCORE: You ${currentVP} VP, Opponent ${opponentVP} VP (${vpDiff >= 0 ? "+" : ""}${vpDiff})`,
  );

  // 2. Your Deck Composition
  const currentAllCards = [
    ...currentPlayer.deck,
    ...currentPlayer.hand,
    ...currentPlayer.discard,
    ...currentPlayer.inPlay,
  ];
  const currentAnalysis = analyzeDeck(currentAllCards);

  sections.push(`YOUR DECK (${currentAllCards.length} cards): ${currentAnalysis.breakdown}
Treasure value: $${currentAnalysis.totalTreasureValue} in ${currentAnalysis.treasures} cards (avg $${currentAnalysis.avgTreasureValue.toFixed(1)})
Terminals: ${currentAnalysis.terminals}, Villages: ${currentAnalysis.villages}`);

  // 3. Shuffle Status
  sections.push(
    `DRAW PILE: ${currentPlayer.deck.length} cards | DISCARD: ${currentPlayer.discard.length} cards`,
  );

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

  sections.push(
    `SUPPLY: Province ${provincesLeft}/8, Duchy ${duchiesLeft}/8${lowPiles ? ` | Low: ${lowPiles}` : ""}${emptyPiles ? ` | Empty: ${emptyPiles}` : ""}`,
  );

  // 5. Opponent Deck
  const opponentAllCards = [
    ...opponent.deck,
    ...opponent.hand,
    ...opponent.discard,
    ...opponent.inPlay,
  ];
  const opponentAnalysis = analyzeDeck(opponentAllCards);

  sections.push(
    `OPPONENT DECK (${opponentAllCards.length} cards): ${opponentAnalysis.breakdown}`,
  );

  // 6. Current Hand (always show for the active player)
  const treasures = currentPlayer.hand.filter(c => isTreasureCard(c));
  const treasureValue = treasures.reduce(
    (sum, c) => sum + (CARDS[c].coins || 0),
    0,
  );
  const maxCoins = state.coins + treasureValue;

  sections.push(`HAND: ${currentPlayer.hand.join(", ")}
Unplayed treasures: $${treasureValue} | Max coins this turn: $${maxCoins}`);

  // 7. Strategy Summary (if provided by LLM analysis)
  if (strategySummary) {
    const strategies = JSON.parse(strategySummary) as Record<
      string,
      PlayerStrategyAnalysis
    >;

    const yourStrategy = strategies[state.activePlayer];
    const opponentStrategy = strategies[opponentId];

    if (yourStrategy || opponentStrategy) {
      sections.push(`\nSTRATEGY ANALYSIS:`);

      if (yourStrategy) {
        sections.push(`YOUR STRATEGY:
  Approach: ${yourStrategy.strategy}
  Execution: ${yourStrategy.execution}
  Position: ${yourStrategy.position}
  Weakness: ${yourStrategy.weakness}
  Threats: ${yourStrategy.threats}
  Next Move: ${yourStrategy.nextMove}`);
      }

      if (opponentStrategy) {
        sections.push(`\nOPPONENT STRATEGY:
  Approach: ${opponentStrategy.strategy}
  Execution: ${opponentStrategy.execution}
  Position: ${opponentStrategy.position}
  Weakness: ${opponentStrategy.weakness}`);
      }
    }
  }

  return sections.join("\n");
}

const calculateVP = (
  deck: CardName[],
  hand: CardName[],
  discard: CardName[],
  inPlay: CardName[],
): number => countVPFromCards([...deck, ...hand, ...discard, ...inPlay]);

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
  const initial: DeckAccumulator = {
    counts: {},
    treasureValue: 0,
    treasureCount: 0,
    terminals: 0,
    villages: 0,
  };
  const { counts, treasureValue, treasureCount, terminals, villages } =
    cards.reduce((acc, card) => {
      const { coins, description } = CARDS[card];
      const newCounts = { ...acc.counts, [card]: (acc.counts[card] || 0) + 1 };
      const hasTreasure = coins
        ? {
            treasureValue: acc.treasureValue + coins,
            treasureCount: acc.treasureCount + 1,
          }
        : {};

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
    }, initial);

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
