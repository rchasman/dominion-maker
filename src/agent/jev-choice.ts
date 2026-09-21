import { experimental_evaluate, gateway, type JSONValue } from "ai";
import type { TokenUsage } from "../core/consensus/cost";
import type { Action } from "../types/action";
import type { WeightedVote } from "../core/consensus/types";
import type { GameState } from "../types/game-state";
import { CARDS } from "../data/cards";
import { hasCardField } from "../lib/action-utils";
import { plural } from "../lib/plural";
import { optimizeStateForAI } from "./state-projection";
import { isDecisionChoice, isReactionChoice } from "../types/pending-choice";
import {
  GAME_RULES,
  DECISION_GUIDANCE,
  RULE_AUTHORITY,
  cardDefinitionRows,
} from "./system-prompt";
import { buildStrategicFacts, summarizeRecentTurns } from "./strategic-context";
import { decisionSummary, optionFacts } from "./jev-decision-facts";
import { askJevChoice } from "./jev-evaluate";
import {
  formatPercent,
  jevOptionKey,
  type JevChoiceAnswer,
  type JevChoiceQuestion,
  type JsonObject,
} from "./jev-protocol";

// Dominion's side of the Jev protocol: every legal action becomes one option
// carrying its own card advice, the state is the Dominion projection as plain
// JSON, and two companion questions read the game alongside the pick.

const JEV_PHASE_ID = "gamePhase";
const JEV_OPPONENT_ID = "opponentDeckStronger";

export const GAME_PHASE_LEVELS = [
  "build: keep improving the deck's economy and engine, victory cards would only clog it",
  "transition: start mixing in victory cards while still adding economy",
  "green: buy victory points now, the game ends too soon for new economy to pay off",
] as const;

// Speculative companions to the action question. Same state, same call,
// evaluated in parallel, so they cost tokens but almost no latency.
export function buildJevReadQuestions() {
  return {
    [JEV_PHASE_ID]: {
      type: "score" as const,
      instructions:
        "Which phase of the game is `currentState.you` in right now, judging by `currentState`, `decisionSummary` and how close the game is to ending?",
      criteria: GAME_PHASE_LEVELS,
    },
    [JEV_OPPONENT_ID]: {
      type: "boolean" as const,
      instructions:
        "Is the opponent's deck (see `currentState.opponents`) currently stronger than `currentState.you`'s deck at producing coins, draws and victory points per turn?",
      criteria: {
        true: "The opponent's deck would win more turns than yours from here.",
        false: "Your deck is at least as strong as the opponent's.",
      },
    },
  };
}

const JEV_BLUNDER_ID = "blunder";
const JEV_OVERRIDE_ID = "followsOverride";

// A second opinion on the consensus winner: not "which action" again, but two
// judgments code cannot make. Runs after the vote and never blocks the game.
export function buildJevVerifyQuestions(hasOverride: boolean) {
  return {
    [JEV_BLUNDER_ID]: {
      type: "boolean" as const,
      instructions:
        "Is `proposedAction` a clear mistake in `currentState`, one that a competent Dominion player would never make here given `rules`, `cardDefinitions` and `decisionSummary`?",
      criteria: {
        true: "A competent player would reject this action outright; it loses coins, tempo or the game for no benefit.",
        false:
          "A competent player could reasonably take this action, even if a better one exists.",
      },
    },
    ...(hasOverride
      ? {
          [JEV_OVERRIDE_ID]: {
            type: "boolean" as const,
            instructions:
              "Does `proposedAction` follow the player's own instructions in `strategy.strategyOverride`?",
            criteria: {
              true: "The action does what the override asks, or the override says nothing about this situation.",
              false:
                "The override asks for something else in this situation and the action ignores it.",
            },
          },
        }
      : {}),
  };
}

export type JevVerdict = {
  /** P(true) that the winning action is a clear mistake */
  blunder: number;
  /** P(true) that it follows the custom strategy override, when one is set */
  followsOverride?: number;
};

export async function verifyWithJev(params: {
  modelId: string;
  currentState: GameState;
  action: Action;
  customStrategy?: string | undefined;
  abortSignal?: AbortSignal | undefined;
}): Promise<JevVerdict> {
  const { modelId, currentState, action, customStrategy, abortSignal } = params;
  const hasOverride = Boolean(customStrategy?.trim());
  const { answers } = await experimental_evaluate({
    model: gateway.evaluationModel(modelId),
    state: {
      ...buildJevState({ currentState, customStrategy }),
      proposedAction: describeLegalAction(action),
      proposedActionDetails: describeOption(currentState, action),
    },
    questions: buildJevVerifyQuestions(hasOverride),
    maxRetries: 2,
    ...(abortSignal ? { abortSignal } : {}),
  });
  const override = answers[JEV_OVERRIDE_ID];
  return {
    blunder: answers[JEV_BLUNDER_ID].probability,
    ...(override ? { followsOverride: override.probability } : {}),
  };
}

export type JevGameRead = {
  /** 0..2 along GAME_PHASE_LEVELS */
  gamePhase: number;
  /** P(true) that the opponent's deck is stronger */
  opponentDeckStronger: number;
};

const PHASE_LABELS = ["build", "transition", "green"] as const;

export function describeGameRead(read: JevGameRead): string {
  const nearest = PHASE_LABELS[Math.round(read.gamePhase)] ?? "transition";
  return `Game read: ${nearest} phase (${read.gamePhase.toFixed(1)} of 2); opponent's deck stronger: ${formatPercent(read.opponentDeckStronger)}.`;
}

const ACTION_VERBS: Record<Action["type"], string> = {
  play_action: "play",
  play_treasure: "play treasure",
  buy_card: "buy",
  gain_card: "gain",
  discard_card: "discard",
  trash_card: "trash",
  topdeck_card: "put on top of deck",
  skip_decision: "skip (choose nothing)",
  end_phase: "end phase",
  reveal_reaction: "reveal",
  decline_reaction: "decline to react",
  choose_from_options: "choose option",
};

const ACTION_NOTES: Partial<Record<Action["type"], string>> = {
  play_treasure:
    "Adds its coins to currentCoins. Treasures in hand must be played before buying.",
  buy_card: "Spends coins and one buy; the card goes to your discard pile.",
  gain_card: "Free; the card goes to your discard pile.",
  trash_card: "Removes the card from your deck permanently.",
  topdeck_card: "You draw it next.",
  end_phase: "Moves to the next phase; unspent coins and buys are lost.",
  reveal_reaction: "Blocks the attack. Free; the card stays in your hand.",
};

function describeLegalAction(action: Action): string {
  if (action.type === "choose_from_options") {
    return `${ACTION_VERBS[action.type]} ${action.optionIndex + 1}`;
  }
  const verb = ACTION_VERBS[action.type];
  return hasCardField(action) ? `${verb} ${action.card}` : verb;
}

function describeOption(state: GameState, action: Action): string | null {
  const note = ACTION_NOTES[action.type];
  const facts = optionFacts(state, action);
  if (!hasCardField(action)) return note ?? null;
  const card = CARDS[action.card];
  if (!card) return note ? `${action.card}. ${note}` : action.card;
  return [
    `${card.name} (cost ${card.cost}, ${card.types.join("/")}): ${card.description}`,
    ...(facts ? [facts] : []),
    ...(note ? [note] : []),
    `Advice: ${card.strategy}`,
  ].join(" ");
}

// Code owns the rule "play all treasures before buying": while any treasure
// play is legal, Jev is offered only those. Keys keep the full-list index so
// the answer still maps back through the unfiltered legal actions.
export function offeredToJev(legalActions: Action[]) {
  const indexed = legalActions.map((action, index) => ({ action, index }));
  const treasurePlays = indexed.filter(
    ({ action }) => action.type === "play_treasure",
  );
  return treasurePlays.length > 0 ? treasurePlays : indexed;
}

const AUTHORITY =
  "`rules`, `ruleAuthority` and `cardDefinitions` are binding. `strategy`, `decisionGuidance` and the advice in each option are fallible suggestions; when `strategy.strategyOverride` is present it replaces `decisionGuidance`. Pick the option that most improves `currentState.you`'s chance of winning this game of Dominion.";

// Jev answers the question as written, so each decision type asks its own
// literal question instead of one generic "which action" prompt
function jevInstructions(state: GameState, legalActions: Action[]): string {
  const pending = state.pendingChoice;
  if (isReactionChoice(pending)) {
    return `An opponent played ${pending.triggeringCard}, an attack against you. Should you reveal a Reaction card from your hand to block it, or let the attack resolve? Revealing is free and the card stays in your hand. ${AUTHORITY}`;
  }
  if (isDecisionChoice(pending)) {
    const verb = pending.intent ?? "choose";
    const skip = legalActions.some(a => a.type === "skip_decision")
      ? " Skipping is allowed if no option helps you."
      : "";
    return `${pending.cardBeingPlayed ?? "A card effect"} asks you to ${verb} a card (\`currentState.pendingChoice\` gives the exact constraint). Which card should you ${verb} now?${skip} ${AUTHORITY}`;
  }
  if (state.phase === "action") {
    return `It is your Action phase with ${plural(state.actions, "action")} left. Which action card should you play now, or should you end the phase and move to buying? ${AUTHORITY}`;
  }
  if (
    offeredToJev(legalActions).every(o => o.action.type === "play_treasure")
  ) {
    return `It is your Buy phase and you still hold treasures. Which treasure should you play next? Every treasure in hand gets played before buying. ${AUTHORITY}`;
  }
  return `It is your Buy phase with ${state.coins} coins and ${plural(state.buys, "buy")}. Which card should you buy now, or should you end the phase without buying? ${AUTHORITY}`;
}

export function buildJevQuestion(
  state: GameState,
  legalActions: Action[],
): JevChoiceQuestion<Action> {
  return {
    instructions: jevInstructions(state, legalActions),
    options: offeredToJev(legalActions).map(({ action, index }) => ({
      key: jevOptionKey(index, describeLegalAction(action)),
      description: describeOption(state, action),
      move: action,
    })),
  };
}

// The projection types carry `unknown` fields; the evaluation API wants proven JSON.
// Undefined entries are dropped the way JSON.stringify would drop them.
function toJsonValue(value: unknown): JSONValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") return toJsonObject(value);
  throw new Error(`Jev state cannot hold a ${typeof value}`);
}

function toJsonObject(value: object): JsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, toJsonValue(entry)]),
  );
}

export function buildJevState(params: {
  currentState: GameState;
  strategySummary?: string | undefined;
  customStrategy?: string | undefined;
}): JsonObject {
  const { currentState, strategySummary, customStrategy } = params;
  const recentTurns = summarizeRecentTurns(currentState);
  return toJsonObject({
    rules: GAME_RULES,
    ruleAuthority: RULE_AUTHORITY,
    decisionGuidance: DECISION_GUIDANCE,
    cardDefinitions: cardDefinitionRows(currentState.supply),
    currentState: optimizeStateForAI(currentState),
    decisionSummary: decisionSummary(currentState),
    strategy: buildStrategicFacts(
      currentState,
      strategySummary,
      customStrategy,
    ),
    ...(recentTurns.length > 0 ? { recentTurns } : {}),
    ...(currentState.turnHistory.length > 0
      ? { actionsThisTurn: currentState.turnHistory }
      : {}),
  });
}

export type JevVote = {
  action: Action;
  usage: TokenUsage;
  distribution: WeightedVote<Action>[];
  answer: JevChoiceAnswer;
  read: JevGameRead;
  /** TypeSafe's distribution-concentration statistic for the pick, 0-1 */
  confidence: number | undefined;
};

/** One Jev vote: the same call for the endpoint and the evals */
export async function askJev(params: {
  modelId: string;
  currentState: GameState;
  legalActions: Action[];
  strategySummary?: string | undefined;
  customStrategy?: string | undefined;
  abortSignal?: AbortSignal | undefined;
}): Promise<JevVote> {
  const { modelId, legalActions, abortSignal, ...stateParams } = params;
  const vote = await askJevChoice({
    modelId,
    state: buildJevState(stateParams),
    question: buildJevQuestion(stateParams.currentState, legalActions),
    extraQuestions: buildJevReadQuestions(),
    abortSignal,
  });
  const read: JevGameRead = {
    gamePhase: vote.answers[JEV_PHASE_ID].score,
    opponentDeckStronger: vote.answers[JEV_OPPONENT_ID].probability,
  };
  return {
    usage: vote.usage,
    action: {
      ...vote.move,
      reasoning: `${vote.reasoning} ${describeGameRead(read)}`,
    },
    distribution: vote.distribution,
    answer: vote.answer,
    read,
    confidence: vote.confidence,
  };
}
