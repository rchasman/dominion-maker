import type { GameState, CardName, LogEntry } from "../types/game-state";
import {
  CARDS,
  isActionCard,
  isTreasureCard,
  isVictoryCard,
} from "../data/cards";
import { countVP as countVPFromCards } from "../lib/board-utils";
import { run } from "../lib/run";

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

const DEFAULT_LAST_N_TURNS = 3;
const SUMMARIES_PER_TURN = 2;

function extractRecentTurns(
  log: LogEntry[],
  lastNTurns = DEFAULT_LAST_N_TURNS,
): TurnSummary[] {
  interface TurnState {
    turnMap: Map<string, TurnSummary>;
    currentTurn: number;
    currentPlayer: string;
  }

  const { turnMap } = log.reduce<TurnState>(
    (state, entry) => {
      if (entry.type === "turn-start") {
        const newTurn = entry.turn;
        const newPlayer = entry.player;
        const key = `${newPlayer}-${newTurn}`;
        if (!state.turnMap.has(key)) {
          state.turnMap.set(key, {
            player: newPlayer,
            turn: newTurn,
            actionsPlayed: [],
            treasuresPlayed: [],
            cardsBought: [],
          });
        }
        return { ...state, currentTurn: newTurn, currentPlayer: newPlayer };
      }

      if (state.currentTurn === 0) return state;

      const player = "player" in entry ? entry.player : state.currentPlayer;
      const key = `${player}-${state.currentTurn}`;
      const summary = state.turnMap.get(key);
      if (!summary) return state;

      if (entry.type === "play-action" && entry.card) {
        summary.actionsPlayed.push(entry.card);
      } else if (entry.type === "play-treasure" && entry.card) {
        summary.treasuresPlayed.push(entry.card);
      } else if (entry.type === "buy-card" && entry.card) {
        summary.cardsBought.push(entry.card);
      }

      return state;
    },
    {
      turnMap: new Map<string, TurnSummary>(),
      currentTurn: 0,
      currentPlayer: "",
    },
  );

  const allSummaries = Array.from(turnMap.values()).sort(
    (a, b) => b.turn - a.turn,
  );
  return allSummaries.slice(0, lastNTurns * SUMMARIES_PER_TURN);
}

/**
 * Formats turn history for LLM analysis
 */
export function formatTurnHistoryForAnalysis(state: GameState): string {
  const recentTurns = extractRecentTurns(state.log, DEFAULT_LAST_N_TURNS);

  if (recentTurns.length === 0) {
    return "";
  }

  const lines = ["RECENT TURN HISTORY:"].concat(
    recentTurns.flatMap(turn => {
      const actions =
        turn.actionsPlayed.length > 0 ? turn.actionsPlayed.join(", ") : "none";
      const buys =
        turn.cardsBought.length > 0 ? turn.cardsBought.join(", ") : "none";

      return [
        `Turn ${turn.turn} (${turn.player}):`,
        `  Actions played: ${actions}`,
        `  Bought: ${buys}`,
      ];
    }),
  );

  return lines.join("\n");
}

interface PlayerStrategyAnalysis {
  gameplan: string;
  read: string;
  lines: string;
}

const DEFAULT_PROVINCE_COUNT = 8;
const DEFAULT_DUCHY_COUNT = 8;
const LOW_PILE_THRESHOLD = 3;

function formatScoreboard(currentVP: number, opponentVP: number): string {
  const vpDiff = currentVP - opponentVP;
  return `SCORE: You ${currentVP} VP, Opponent ${opponentVP} VP (${vpDiff >= 0 ? "+" : ""}${vpDiff})`;
}

function formatDeckComposition(cards: CardName[]): string {
  const analysis = analyzeDeck(cards);
  return `YOUR DECK (${cards.length} cards): ${analysis.breakdown}
Treasure value: $${analysis.totalTreasureValue} in ${analysis.treasures} cards (avg $${analysis.avgTreasureValue.toFixed(1)})
Terminals: ${analysis.terminals}, Villages: ${analysis.villages}`;
}

function formatSupplyStatus(supply: Record<string, number>): string {
  const provincesLeft = supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const duchiesLeft = supply["Duchy"] ?? DEFAULT_DUCHY_COUNT;
  const supplyEntries = Object.entries(supply);
  const lowPiles = supplyEntries
    .filter(([, count]) => count <= LOW_PILE_THRESHOLD && count > 0)
    .map(([card, count]) => `${card}: ${count}`)
    .join(", ");
  const emptyPiles = supplyEntries
    .filter(([, count]) => count === 0)
    .map(([card]) => card)
    .join(", ");

  return `SUPPLY: Province ${provincesLeft}/${DEFAULT_PROVINCE_COUNT}, Duchy ${duchiesLeft}/${DEFAULT_DUCHY_COUNT}${lowPiles ? ` | Low: ${lowPiles}` : ""}${emptyPiles ? ` | Empty: ${emptyPiles}` : ""}`;
}

function formatHandStatus(
  hand: CardName[],
  currentCoins: number,
  phase: string,
): string {
  const treasures = hand.filter(c => isTreasureCard(c));
  const treasureValue = treasures.reduce(
    (sum, c) => sum + (CARDS[c].coins || 0),
    0,
  );
  const maxCoins = currentCoins + treasureValue;

  if (phase === "buy") {
    if (treasures.length > 0) {
      return `HAND: ${hand.join(", ")}
COINS: $${currentCoins} activated | $${treasureValue} in hand (${treasures.join(", ")}) | $${maxCoins} total if all treasures played`;
    }
    return `HAND: ${hand.join(", ")}
COINS: $${currentCoins} (all treasures played)`;
  }

  return `HAND: ${hand.join(", ")}
Treasures in hand: $${treasureValue} | Potential this turn: $${maxCoins}`;
}

function formatAvailableBuyOptions(
  supply: Record<string, number>,
  currentCoins: number,
  maxCoins: number,
): string {
  if (currentCoins === maxCoins) {
    // All treasures played - show single list
    const allCards = Object.entries(supply)
      .filter(([cardName, count]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return count > 0 && cost <= maxCoins;
      })
      .map(([cardName]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        const cardInfo = CARDS[card];
        const desc = cardInfo.description || "";
        return `  ${card}($${cost}): ${desc}`;
      })
      .join("\n");

    if (!allCards) return "";
    return `BUYABLE:\n${allCards}`;
  }

  // Have unplayed treasures - show current vs potential
  const currentCards = Object.entries(supply)
    .filter(([cardName, count]) => {
      const card = cardName as CardName;
      const cost = CARDS[card]?.cost || 0;
      return count > 0 && cost <= currentCoins;
    })
    .map(([cardName]) => {
      const card = cardName as CardName;
      const cost = CARDS[card]?.cost || 0;
      return `${card}($${cost})`;
    });

  const potentialCards = Object.entries(supply)
    .filter(([cardName, count]) => {
      const card = cardName as CardName;
      const cost = CARDS[card]?.cost || 0;
      return count > 0 && cost <= maxCoins && cost > currentCoins;
    })
    .map(([cardName]) => {
      const card = cardName as CardName;
      const cost = CARDS[card]?.cost || 0;
      const cardInfo = CARDS[card];
      const desc = cardInfo.description || "";
      return `  ${card}($${cost}): ${desc}`;
    });

  const currentList =
    currentCards.length > 0 ? currentCards.join(", ") : "none";
  const potentialList =
    potentialCards.length > 0 ? potentialCards.join("\n") : "  none";

  return `BUYABLE:
  With $${currentCoins} now: ${currentList}
  With $${maxCoins} (after all treasures):
${potentialList}`;
}

function formatStrategyAnalysis(
  strategySummary: string,
  activePlayerId: string,
  opponentId: string,
): string[] {
  const strategies = JSON.parse(strategySummary) as Record<
    string,
    PlayerStrategyAnalysis
  >;

  const yourStrategy = strategies[activePlayerId];
  const opponentStrategy = strategies[opponentId];

  if (!yourStrategy && !opponentStrategy) return [];

  const sections = ["\nSTRATEGY ANALYSIS:"];

  if (yourStrategy) {
    sections.push(`YOUR STRATEGY:
  Gameplan: ${yourStrategy.gameplan}
  Read: ${yourStrategy.read}
  Lines: ${yourStrategy.lines}`);
  }

  if (opponentStrategy) {
    sections.push(`\nOPPONENT STRATEGY:
  Gameplan: ${opponentStrategy.gameplan}
  Read: ${opponentStrategy.read}`);
  }

  return sections;
}

/**
 * Builds human-readable game facts that a real Dominion player would track.
 * Pure data - no strategy advice.
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
): string {
  const currentPlayer = state.players[state.activePlayer];
  const opponentId = Object.keys(state.players).find(
    id => id !== state.activePlayer,
  ) as keyof typeof state.players;
  const opponent = state.players[opponentId];

  const currentAllCards = [
    ...currentPlayer.deck,
    ...currentPlayer.hand,
    ...currentPlayer.discard,
    ...currentPlayer.inPlay,
  ];
  const opponentAllCards = [
    ...opponent.deck,
    ...opponent.hand,
    ...opponent.discard,
    ...opponent.inPlay,
  ];

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

  const treasures = currentPlayer.hand.filter(c => isTreasureCard(c));
  const treasureValue = treasures.reduce(
    (sum, c) => sum + (CARDS[c].coins || 0),
    0,
  );
  const maxCoins = state.coins + treasureValue;

  const sections = [
    formatScoreboard(currentVP, opponentVP),
    formatDeckComposition(currentAllCards),
    `DRAW PILE: ${currentPlayer.deck.length} cards | DISCARD: ${currentPlayer.discard.length} cards`,
    formatSupplyStatus(state.supply),
    `OPPONENT DECK (${opponentAllCards.length} cards): ${analyzeDeck(opponentAllCards).breakdown}`,
    formatHandStatus(currentPlayer.hand, state.coins, state.phase),
  ];

  if (state.phase === "buy") {
    const buyOptions = formatAvailableBuyOptions(
      state.supply,
      state.coins,
      maxCoins,
    );
    if (buyOptions) {
      sections.push(buyOptions);
    }
  }

  if (strategySummary) {
    sections.push(
      ...formatStrategyAnalysis(
        strategySummary,
        state.activePlayer,
        opponentId,
      ),
    );
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

      const actionUpdate = run(() => {
        if (!isActionCard(card)) return {};
        if (description.includes("+2 Actions"))
          return { villages: acc.villages + 1 };
        if (!description.includes("+1 Action"))
          return { terminals: acc.terminals + 1 };
        return {};
      });

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
