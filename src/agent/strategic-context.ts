import type { GameState, CardName, LogEntry } from "../types/game-state";
import {
  CARDS,
  isActionCard,
  isTreasureCard,
  isVictoryCard,
} from "../data/cards";
import { countVP as countVPFromCards } from "../lib/board-utils";
import { run } from "../lib/run";
import { encodeToon } from "../lib/toon";
import { z } from "zod";

/**
 * Zod schema with self-documenting field names
 */
const StrategicFactsSchema = z.object({
  currentTurnNumber: z.number(),
  gameStage: z.enum(["Early", "Mid", "Late"]),
  yourVictoryPoints: z.number(),
  opponentVictoryPoints: z.number(),
  victoryPointDifference: z.number(),
  provincesYouNeedToWin: z.number(),
  provincesTheyNeedToWin: z.number(),
  yourDeckTotalCards: z.number(),
  yourDeckComposition: z.record(z.number()),
  yourTreasureCount: z.number(),
  yourActionCount: z.number(),
  yourVictoryCardCount: z.number(),
  yourTotalTreasureValue: z.number(),
  yourAvgTreasureValue: z.number(),
  yourVillageCount: z.number(),
  yourTerminalCount: z.number(),
  yourDeckCycleTime: z.number(),
  yourDrawPileCount: z.number(),
  yourDiscardPileCount: z.number(),
  shuffleNextTurn: z.boolean(),
  opponentDeckTotalCards: z.number(),
  opponentDeckComposition: z.record(z.number()),
  opponentTotalTreasureValue: z.number(),
  opponentAvgTreasureValue: z.number(),
  supplyPiles: z.record(z.number()),
  handCards: z.array(z.string()),
  coinsActivatedThisTurn: z.number(),
  coinsInUnplayedTreasures: z.number(),
  maxCoinsIfAllTreasuresPlayed: z.number(),
  unplayedTreasuresInHand: z.array(z.string()),
  buyableWithCurrentCoins: z
    .array(z.object({ card: z.string(), cost: z.number() }))
    .optional(),
  whatEachUnplayedTreasureUnlocks: z
    .array(
      z.object({
        treasureName: z.string(),
        coinValue: z.number(),
        newCoinTotal: z.number(),
        cardsUnlocked: z.array(
          z.object({ card: z.string(), cost: z.number() }),
        ),
      }),
    )
    .optional(),
  strategyOverride: z.string().optional(),
});

type StrategicFacts = z.infer<typeof StrategicFactsSchema>;

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
const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;

function formatScoreboard(
  currentVP: number,
  opponentVP: number,
  turn: number,
  provincesLeft: number,
): string {
  const vpDiff = currentVP - opponentVP;
  const gameStage =
    turn <= EARLY_GAME_TURN_THRESHOLD
      ? "Early"
      : provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD
        ? "Late"
        : "Mid";

  const PROVINCE_VP = 6;
  const youNeed = Math.ceil((opponentVP + 1 - currentVP) / PROVINCE_VP);
  const theyNeed = Math.ceil((currentVP + 1 - opponentVP) / PROVINCE_VP);

  return `Turn ${turn} (${gameStage}) | You ${currentVP}VP, Opp ${opponentVP}VP (${vpDiff >= 0 ? "+" : ""}${vpDiff}) | You need ${youNeed}P, they need ${theyNeed}P`;
}

function formatDeckComposition(cards: CardName[]): string {
  const analysis = analyzeDeck(cards);
  const treasureDensity = ((analysis.treasures / cards.length) * 100).toFixed(
    0,
  );
  const actionDensity = ((analysis.actions / cards.length) * 100).toFixed(0);
  const vpDensity = ((analysis.victory / cards.length) * 100).toFixed(0);
  const cycleTime = (cards.length / 5).toFixed(1);

  return `YOUR DECK (${cards.length} cards): ${analysis.breakdown}
Economy: $${analysis.totalTreasureValue} in ${analysis.treasures} treasures (${treasureDensity}% density, avg $${analysis.avgTreasureValue.toFixed(1)}/card)
Engine: ${analysis.actions} actions (${actionDensity}%) - ${analysis.villages} villages, ${analysis.terminals} terminals
Cycle: ${cycleTime} turns | VP: ${analysis.victory} cards (${vpDensity}%)`;
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
COINS: $${currentCoins} activated | $${treasureValue} in hand (${treasures.join(", ")}) | $${maxCoins} total if all played`;
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
  unplayedTreasures: CardName[],
): string {
  // All treasures played - show single list
  if (currentCoins === maxCoins) {
    const allCards = Object.entries(supply)
      .filter(([cardName, count]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return count > 0 && cost <= maxCoins;
      })
      .map(([cardName]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return `${card}($${cost})`;
      })
      .join(", ");

    return allCards ? `BUYABLE ($${maxCoins}): ${allCards}` : "";
  }

  // Have unplayed treasures - show what each unlocks
  const lines: string[] = [];
  let runningTotal = currentCoins;

  unplayedTreasures.map(treasure => {
    const treasureValue = CARDS[treasure].coins || 0;
    runningTotal += treasureValue;

    const newlyUnlocked = Object.entries(supply)
      .filter(([cardName, count]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return (
          count > 0 &&
          cost <= runningTotal &&
          cost > runningTotal - treasureValue
        );
      })
      .map(([cardName]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return `${card}($${cost})`;
      });

    if (newlyUnlocked.length > 0) {
      lines.push(
        `Play ${treasure}(+$${treasureValue}) → $${runningTotal}: ${newlyUnlocked.join(", ")}`,
      );
    }
  });

  return lines.length > 0 ? lines.join("\n") : "";
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
 * Builds structured game facts as TOON-encoded data
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
  customStrategy?: string,
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

  const provincesLeft = state.supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const gameStage: "Early" | "Mid" | "Late" =
    state.turn <= EARLY_GAME_TURN_THRESHOLD
      ? "Early"
      : provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD
        ? "Late"
        : "Mid";

  const PROVINCE_VP = 6;
  const youNeed = Math.ceil((opponentVP + 1 - currentVP) / PROVINCE_VP);
  const theyNeed = Math.ceil((currentVP + 1 - opponentVP) / PROVINCE_VP);

  const yourAnalysis = analyzeDeck(currentAllCards);
  const opponentAnalysis = analyzeDeck(opponentAllCards);

  const treasures = currentPlayer.hand.filter(c => isTreasureCard(c));
  const treasureValue = treasures.reduce(
    (sum, c) => sum + (CARDS[c].coins || 0),
    0,
  );
  const maxCoins = state.coins + treasureValue;

  const facts: StrategicFacts = {
    currentTurnNumber: state.turn,
    gameStage,
    yourVictoryPoints: currentVP,
    opponentVictoryPoints: opponentVP,
    victoryPointDifference: currentVP - opponentVP,
    provincesYouNeedToWin: youNeed,
    provincesTheyNeedToWin: theyNeed,
    yourDeckTotalCards: currentAllCards.length,
    yourDeckComposition: yourAnalysis.counts,
    yourTreasureCount: yourAnalysis.treasures,
    yourActionCount: yourAnalysis.actions,
    yourVictoryCardCount: yourAnalysis.victory,
    yourTotalTreasureValue: yourAnalysis.totalTreasureValue,
    yourAvgTreasureValue: yourAnalysis.avgTreasureValue,
    yourVillageCount: yourAnalysis.villages,
    yourTerminalCount: yourAnalysis.terminals,
    yourDeckCycleTime: parseFloat((currentAllCards.length / 5).toFixed(1)),
    yourDrawPileCount: currentPlayer.deck.length,
    yourDiscardPileCount: currentPlayer.discard.length,
    shuffleNextTurn:
      currentPlayer.deck.length <= 5 && currentPlayer.discard.length > 0,
    opponentDeckTotalCards: opponentAllCards.length,
    opponentDeckComposition: opponentAnalysis.counts,
    opponentTotalTreasureValue: opponentAnalysis.totalTreasureValue,
    opponentAvgTreasureValue: opponentAnalysis.avgTreasureValue,
    supplyPiles: state.supply,
    handCards: currentPlayer.hand,
    coinsActivatedThisTurn: state.coins,
    coinsInUnplayedTreasures: treasureValue,
    maxCoinsIfAllTreasuresPlayed: maxCoins,
    unplayedTreasuresInHand: treasures,
    strategyOverride: customStrategy?.trim() || undefined,
  };

  // Add buy options if in buy phase
  if (state.phase === "buy") {
    const current = Object.entries(state.supply)
      .filter(([cardName, count]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return count > 0 && cost <= state.coins;
      })
      .map(([cardName]) => ({
        card: cardName,
        cost: CARDS[cardName as CardName]?.cost || 0,
      }));

    const unlocks = treasures
      .map((treasure, idx) => {
        const treasureValue = CARDS[treasure].coins || 0;
        const runningTotal =
          state.coins +
          treasures
            .slice(0, idx + 1)
            .reduce((sum, t) => sum + (CARDS[t].coins || 0), 0);
        const prevTotal =
          idx === 0
            ? state.coins
            : state.coins +
              treasures
                .slice(0, idx)
                .reduce((sum, t) => sum + (CARDS[t].coins || 0), 0);

        const unlocked = Object.entries(state.supply)
          .filter(([cardName, count]) => {
            const cost = CARDS[cardName as CardName]?.cost || 0;
            return count > 0 && cost <= runningTotal && cost > prevTotal;
          })
          .map(([cardName]) => ({
            card: cardName,
            cost: CARDS[cardName as CardName]?.cost || 0,
          }));

        return {
          treasureName: treasure,
          coinValue: treasureValue,
          newCoinTotal: runningTotal,
          cardsUnlocked: unlocked,
        };
      })
      .filter(u => u.cardsUnlocked.length > 0);

    facts.buyableWithCurrentCoins = current;
    facts.whatEachUnplayedTreasureUnlocks = unlocks;
  }

  const toonData = encodeToon(facts);

  // Append strategy override prominently if present
  if (customStrategy && customStrategy.trim()) {
    return `${toonData}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSTRATEGY OVERRIDE (follow absolutely):\n${customStrategy.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  return toonData;
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
  counts: Record<string, number>;
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
    counts,
  };
}
