import type { GameState, LogEntry, CardName } from "../types/game-state";
import { run } from "../lib/run";
import { encodeToon } from "../lib/toon";

type StrategicFacts = {
  // AI strategy (gameplan, situational read, recommendation)
  aiStrategyGameplan?: string;
  aiStrategyRead?: string;
  aiStrategyRecommendation?: string;
  strategyOverride?: string;
};

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

const DEFAULT_LAST_N_TURNS = 3; // For quick decision-making (per action)
export const STRATEGY_ANALYSIS_TURNS = 7; // For strategy analysis (once per turn)
const SUMMARIES_PER_TURN = 2;

/**
 * Default strategy used before first analysis completes
 * Provides reasoning primitives, not conclusions - let the AI derive good moves
 */
export const DEFAULT_STRATEGY = {
  gameplan: "Build Economy → Add Draw/Actions → Score VP",
  read: "Early game: Silver/Gold improve average hand. Action cards that draw (+Cards) or give +Actions let you play more per turn. Weak cards (Copper, early Estates) dilute deck and reduce hand quality.",
  recommendation:
    "Each buy: ask 'does this make my average hand stronger?' Silver > Copper always. Province > Duchy > Estate. Skip VP until you can hit $8 consistently or game is ending.",
};

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
          const newTurnMap = new Map(state.turnMap);
          newTurnMap.set(key, {
            player: newPlayer,
            turn: newTurn,
            actionsPlayed: [],
            treasuresPlayed: [],
            cardsBought: [],
          });
          return {
            ...state,
            turnMap: newTurnMap,
            currentTurn: newTurn,
            currentPlayer: newPlayer,
          };
        }
        return { ...state, currentTurn: newTurn, currentPlayer: newPlayer };
      }

      if (state.currentTurn === 0) return state;

      const player = "player" in entry ? entry.player : state.currentPlayer;
      const key = `${player}-${state.currentTurn}`;
      const summary = state.turnMap.get(key);
      if (!summary) return state;

      const fieldMap = {
        "play-action": "actionsPlayed",
        "play-treasure": "treasuresPlayed",
        "buy-card": "cardsBought",
      } as const;

      const field = fieldMap[entry.type as keyof typeof fieldMap];
      if (field && entry.card) {
        const newSummary = {
          ...summary,
          [field]: [...summary[field], entry.card],
        };
        const newTurnMap = new Map(state.turnMap);
        newTurnMap.set(key, newSummary);
        return { ...state, turnMap: newTurnMap };
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
 * Returns TOON-encoded compact turn summaries
 *
 * @param state - Current game state
 * @param format - Output format (toon or json)
 * @param turnCount - Number of turns to include (default 3 for decisions, use 7 for strategy)
 */
export function formatTurnHistoryForAnalysis(
  state: GameState,
  format: "json" | "toon" = "toon",
  turnCount = DEFAULT_LAST_N_TURNS,
): string {
  const recentTurns = extractRecentTurns(state.log, turnCount);

  if (recentTurns.length === 0) {
    return "";
  }

  // Convert player IDs to "you" and "opponent" for consistency
  const activePlayerId = state.activePlayer;
  const compactTurns = recentTurns.map(turn => ({
    turn: turn.turn,
    player: turn.player === activePlayerId ? "you" : "opponent",
    actions: turn.actionsPlayed.length > 0 ? turn.actionsPlayed : null,
    bought: turn.cardsBought.length > 0 ? turn.cardsBought : null,
  }));

  const content =
    format === "toon"
      ? encodeToon(compactTurns)
      : JSON.stringify(compactTurns, null, JSON_INDENT_SPACES);

  return `RECENT TURN HISTORY:\n${content}`;
}

interface PlayerStrategyAnalysis {
  gameplan: string;
  read: string;
  recommendation: string;
}

const JSON_INDENT_SPACES = 2;

/**
 * Builds structured game facts encoded based on format
 * Only includes strategic insights - removes data already present in game state
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
  customStrategy?: string,
  format: "json" | "toon" = "toon",
): string {
  // Strategic insights only - AI strategy analysis
  const facts: StrategicFacts = {};

  // Add AI's own strategy analysis (not opponent's - no cheating)
  // Use provided strategy or default neutral strategy
  const aiStrategy = run(() => {
    if (strategySummary) {
      const strategies = JSON.parse(strategySummary) as Array<
        PlayerStrategyAnalysis & { id: string }
      >;
      return strategies.find(s => s.id === state.activePlayer);
    }
    return DEFAULT_STRATEGY;
  });

  if (aiStrategy) {
    facts.aiStrategyGameplan = aiStrategy.gameplan;
    facts.aiStrategyRead = aiStrategy.read;
    facts.aiStrategyRecommendation = aiStrategy.recommendation;
  }

  // Add custom override
  if (customStrategy?.trim()) {
    facts.strategyOverride = customStrategy.trim();
  }

  return format === "toon"
    ? encodeToon(facts)
    : JSON.stringify(facts, null, JSON_INDENT_SPACES);
}
