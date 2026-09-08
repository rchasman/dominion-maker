import { z } from "zod";
import { strategyPlanSchema, type StrategyPlan } from "./strategy-plan";
import { run } from "../lib/run";
import { isAnalysisApplicable } from "./analysis-version";
import type {
  GameState,
  LogEntry,
  CardName,
  PlayerId,
} from "../types/game-state";
import { getDecisionPlayerId } from "./state-projection";
import { encodeToon } from "../lib/toon";

type StrategicFacts = {
  // Unverified conditional advice, never display commentary.
  aiDecisionPlan?: StrategyPlan;
  strategyOverride?: string;
  analysisAgeTurns?: number | string;
  analysisSourceEventId?: string;
};

/**
 * Extracts recent turn actions from game log for strategy analysis
 */
interface TurnSummary {
  playerId: PlayerId;
  turn: number;
  actionsPlayed: CardName[];
  treasuresPlayed: CardName[];
  cardsBought: CardName[];
  cardsGained: CardName[];
  cardsTrashed: CardName[];
}

const DEFAULT_LAST_N_TURNS = 3; // For quick decision-making (per action)
export const STRATEGY_ANALYSIS_TURNS = 7; // For strategy analysis (once per turn)

/**
 * Default strategy used before first analysis completes
 * Provides reasoning primitives, not conclusions - let the AI derive good moves
 */
export const DEFAULT_STRATEGY: StrategyPlan = {
  priority:
    "No analysis yet — choose an economy, engine, attack or alternate scoring plan for this kingdom.",
  conditions: [
    "Balance draw, actions and payload against the deck and supply.",
    "Score when it improves winning chances; check pile-ending consequences before ending the game.",
    "Treat card advice as conditional, not mandatory.",
  ],
};

function extractRecentTurns(
  log: LogEntry[],
  lastNTurns = DEFAULT_LAST_N_TURNS,
  playerCount = 2,
): TurnSummary[] {
  interface TurnState {
    turnMap: Map<string, TurnSummary>;
    currentTurn: number;
    trackedPlayerId: string;
  }

  const flatten = (entries: LogEntry[]): LogEntry[] =>
    entries.flatMap(entry => [entry, ...flatten(entry.children ?? [])]);
  const { turnMap } = flatten(log).reduce<TurnState>(
    (state, entry) => {
      if (entry.type === "turn-start") {
        const newTurn = entry.turn;
        const newPlayerId = entry.playerId;
        const key = `${newPlayerId}-${newTurn}`;
        if (!state.turnMap.has(key)) {
          const newTurnMap = new Map(state.turnMap);
          newTurnMap.set(key, {
            playerId: newPlayerId,
            turn: newTurn,
            actionsPlayed: [],
            treasuresPlayed: [],
            cardsBought: [],
            cardsGained: [],
            cardsTrashed: [],
          });
          return {
            ...state,
            turnMap: newTurnMap,
            currentTurn: newTurn,
            trackedPlayerId: newPlayerId,
          };
        }
        return { ...state, currentTurn: newTurn, trackedPlayerId: newPlayerId };
      }

      if (state.currentTurn === 0) return state;

      const playerId =
        "playerId" in entry ? entry.playerId : state.trackedPlayerId;
      const key = `${playerId}-${state.currentTurn}`;
      const summary = state.turnMap.get(key) ?? {
        playerId,
        turn: state.currentTurn,
        actionsPlayed: [],
        treasuresPlayed: [],
        cardsBought: [],
        cardsGained: [],
        cardsTrashed: [],
      };

      const fieldMap = {
        "play-action": "actionsPlayed",
        "play-treasure": "treasuresPlayed",
        "buy-card": "cardsBought",
        "gain-card": "cardsGained",
        "trash-card": "cardsTrashed",
      } as const;

      const field = fieldMap[entry.type as keyof typeof fieldMap];
      const cards = run(() => {
        if ("card" in entry && entry.card) return [entry.card];
        return entry.type === "trash-card" ? (entry.cards ?? []) : [];
      });
      if (field && cards.length) {
        const newSummary = {
          ...summary,
          [field]: [...summary[field], ...cards],
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
      trackedPlayerId: "",
    },
  );

  const allSummaries = Array.from(turnMap.values()).sort(
    (a, b) => b.turn - a.turn,
  );
  return allSummaries.slice(0, lastNTurns * playerCount);
}

/**
 * Formats turn history for LLM analysis
 * Returns TOON-encoded compact turn summaries
 *
 * @param state - Current game state
 * @param turnCount - Number of turns to include (default 3 for decisions, use 7 for strategy)
 */
export function formatTurnHistoryForAnalysis(
  state: GameState,
  turnCount = DEFAULT_LAST_N_TURNS,
): string {
  const recentTurns = extractRecentTurns(
    state.log,
    turnCount,
    Object.keys(state.players).length,
  );

  if (recentTurns.length === 0) {
    return "";
  }

  // Keep stable IDs: this history is also used to analyze non-active players.
  const compactTurns = recentTurns.map(turn => ({
    turn: turn.turn,
    playerId: turn.playerId,
    actions: turn.actionsPlayed.length > 0 ? turn.actionsPlayed : null,
    bought: turn.cardsBought.length > 0 ? turn.cardsBought : null,
    gained: turn.cardsGained.length > 0 ? turn.cardsGained : null,
    trashed: turn.cardsTrashed.length > 0 ? turn.cardsTrashed : null,
  }));

  const content = encodeToon(compactTurns);

  return `RECENT TURN HISTORY:\n${content}`;
}

const strategySchema = z.record(
  z.string(),
  z.object({
    decisionPlan: strategyPlanSchema.optional(),
    analysis: z
      .object({
        turn: z.number().int().nonnegative(),
        gameEventId: z.string(),
        sourceEventId: z.string(),
      })
      .optional(),
  }),
);

/**
 * Builds structured game facts encoded in TOON format
 * Only includes strategic insights - removes data already present in game state
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
  customStrategy?: string,
): string {
  // Strategic insights only - AI strategy analysis
  const facts: StrategicFacts = {};

  // Add AI's own strategy analysis (not opponent's - no cheating)
  // Use provided strategy or default neutral strategy
  const aiStrategy = run(() => {
    if (!strategySummary) return DEFAULT_STRATEGY;
    try {
      const parsed: unknown = JSON.parse(strategySummary);
      const result = strategySchema.safeParse(parsed);
      const candidate = result.success
        ? result.data[getDecisionPlayerId(state)]
        : undefined;
      if (!candidate?.decisionPlan) return DEFAULT_STRATEGY;
      const metadata = candidate.analysis;
      if (metadata && !isAnalysisApplicable(metadata, state))
        return DEFAULT_STRATEGY;
      facts.analysisAgeTurns = metadata
        ? state.turn - metadata.turn
        : "unknown (legacy analysis)";
      if (metadata) facts.analysisSourceEventId = metadata.sourceEventId;
      return candidate.decisionPlan;
    } catch {
      // A malformed or obsolete summary must not prevent a legal decision.
      return DEFAULT_STRATEGY;
    }
  });

  if (aiStrategy) {
    facts.aiDecisionPlan = aiStrategy;
  }

  // Add custom override
  if (customStrategy?.trim()) {
    facts.strategyOverride = customStrategy.trim();
  }

  return encodeToon(facts);
}
