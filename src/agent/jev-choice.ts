import { experimental_evaluate, gateway } from "ai";
import type { JSONValue } from "ai";
import { z } from "zod";
import type { Action, WeightedVote } from "../types/action";
import type { GameState } from "../types/game-state";
import { CARDS } from "../data/cards";
import { hasCardField } from "../lib/action-utils";
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

// Jev (TypeSafe's System One model) answers a typed Choice question instead of
// writing JSON with reasoning. Every legal action becomes one option; the
// answer maps back to the action by its number. No text parsing, no retry.
// Jev reads JSON, not TOON, and loses accuracy on indirection, so the state is
// plain objects with named fields and each option carries its own card advice.

export const JEV_QUESTION_ID = "action";

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

function jevOptionKey(index: number, action: Action): string {
  return `${index + 1}. ${describeLegalAction(action)}`;
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
    return `It is your Action phase with ${state.actions} action${state.actions === 1 ? "" : "s"} left. Which action card should you play now, or should you end the phase and move to buying? Cards that give +Actions go before terminal cards. ${AUTHORITY}`;
  }
  if (
    offeredToJev(legalActions).every(o => o.action.type === "play_treasure")
  ) {
    return `It is your Buy phase and you still hold treasures. Which treasure should you play next? Every treasure in hand gets played before buying; the order rarely matters. ${AUTHORITY}`;
  }
  return `It is your Buy phase with ${state.coins} coins and ${state.buys} buy${state.buys === 1 ? "" : "s"}. Which card should you buy now, or should you end the phase without buying? ${AUTHORITY}`;
}

export function buildJevQuestion(state: GameState, legalActions: Action[]) {
  return {
    type: "choice" as const,
    instructions: jevInstructions(state, legalActions),
    criteria: Object.fromEntries(
      offeredToJev(legalActions).map(({ action, index }) => [
        jevOptionKey(index, action),
        describeOption(state, action),
      ]),
    ),
  };
}

type JsonObject = { [key: string]: JSONValue };

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
  humanChoice?: { selectedCards: string[] } | undefined;
}): JsonObject {
  const { currentState, strategySummary, customStrategy, humanChoice } = params;
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
    ...(humanChoice ? { humanChoice: humanChoice.selectedCards } : {}),
  });
}

type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
};

const PERCENT = 100;
const formatPercent = (probability: number): string =>
  `${Math.round(probability * PERCENT)}%`;

function summariseDistribution(
  choice: string,
  probabilities: Record<string, number> | undefined,
): string {
  if (!probabilities) return "Jev picked this option.";
  const chosen = probabilities[choice];
  const runnerUp = Object.entries(probabilities)
    .filter(([key]) => key !== choice)
    .sort(([, a], [, b]) => b - a)[0];
  const lead =
    chosen === undefined
      ? "Jev picked this option."
      : `Jev picked this with ${formatPercent(chosen)} probability.`;
  if (!runnerUp) return lead;
  const [runnerUpKey, runnerUpProbability] = runnerUp;
  const runnerUpLabel = runnerUpKey.replace(/^\d+\. /, "");
  return `${lead} Runner-up: ${runnerUpLabel} (${formatPercent(runnerUpProbability)}).`;
}

export function jevAnswerToAction(
  answer: JevChoiceAnswer,
  legalActions: Action[],
): Action {
  const index = legalActions.findIndex(
    (action, i) => jevOptionKey(i, action) === answer.choice,
  );
  const legal = legalActions[index];
  if (!legal) {
    throw new Error(`choice "${answer.choice}" is not an offered option`);
  }
  return {
    ...legal,
    reasoning: summariseDistribution(answer.choice, answer.probabilities),
  };
}

/** Jev's whole distribution as weighted votes, so the tally can use the mass and not just the argmax */
export function jevDistribution(
  answer: JevChoiceAnswer,
  legalActions: Action[],
): WeightedVote[] {
  if (!answer.probabilities) {
    return [{ action: jevAnswerToAction(answer, legalActions), weight: 1 }];
  }
  return Object.entries(answer.probabilities)
    .filter(([, weight]) => weight > 0)
    .flatMap(([key, weight]) => {
      const index = legalActions.findIndex(
        (action, i) => jevOptionKey(i, action) === key,
      );
      const legal = legalActions[index];
      return legal ? [{ action: legal, weight }] : [];
    });
}

export type JevVote = {
  action: Action;
  distribution: WeightedVote[];
  answer: JevChoiceAnswer;
  /** TypeSafe's distribution-concentration statistic for the pick, 0-1 */
  confidence: number | undefined;
};

const typesafeMetadataSchema = z.object({
  typesafe: z.object({ confidence: z.record(z.string(), z.number()) }),
});

function readTypesafeConfidence(metadata: unknown): number | undefined {
  const parsed = typesafeMetadataSchema.safeParse(metadata);
  return parsed.success
    ? parsed.data.typesafe.confidence[JEV_QUESTION_ID]
    : undefined;
}

/** One Jev vote: the same call for the endpoint and the evals */
export async function askJev(params: {
  modelId: string;
  currentState: GameState;
  legalActions: Action[];
  strategySummary?: string | undefined;
  customStrategy?: string | undefined;
  humanChoice?: { selectedCards: string[] } | undefined;
  abortSignal?: AbortSignal | undefined;
}): Promise<JevVote> {
  const { modelId, legalActions, abortSignal, ...stateParams } = params;
  // Jev's rate limits move with demand; a 429 should not fail the vote outright
  const { answers, providerMetadata } = await experimental_evaluate({
    model: gateway.evaluationModel(modelId),
    state: buildJevState(stateParams),
    questions: {
      [JEV_QUESTION_ID]: buildJevQuestion(
        stateParams.currentState,
        legalActions,
      ),
    },
    maxRetries: 2,
    ...(abortSignal ? { abortSignal } : {}),
  });
  const answer = answers[JEV_QUESTION_ID];
  return {
    action: jevAnswerToAction(answer, legalActions),
    distribution: jevDistribution(answer, legalActions),
    answer,
    confidence: readTypesafeConfidence(providerMetadata),
  };
}
