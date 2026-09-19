import type { Action } from "../types/action";
import type { GameState } from "../types/game-state";
import { CARDS } from "../data/cards";
import { hasCardField } from "../lib/action-utils";
import { encodeToon } from "../lib/toon";
import { optimizeStateForAI, getDecisionPlayerId } from "./state-projection";
import {
  GAME_RULES,
  DECISION_GUIDANCE,
  buildCardReference,
} from "./system-prompt";

// Jev (TypeSafe's System One model) answers a typed Choice question instead of
// writing JSON with reasoning. Every legal action becomes one option; the
// answer maps back to the action by its number. No text parsing, no retry.

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

function describeOption(action: Action): string | null {
  const note = ACTION_NOTES[action.type];
  if (!hasCardField(action)) return note ?? null;
  const card = CARDS[action.card];
  const cardText = card
    ? `${card.name} (cost ${card.cost}, ${card.types.join("/")}): ${card.description}`
    : action.card;
  return note ? `${cardText} ${note}` : cardText;
}

export function buildJevQuestion(legalActions: Action[]) {
  return {
    type: "choice" as const,
    instructions:
      "Which one of these legal actions should the player `you` in `currentState` take right now to maximise their chance of winning this game of Dominion? Follow `rules` and `cardReference`; use `strategicContext` and `decisionGuidance` as advice.",
    criteria: Object.fromEntries(
      legalActions.map((action, index) => [
        jevOptionKey(index, action),
        describeOption(action),
      ]),
    ),
  };
}

export function buildJevState(params: {
  currentState: GameState;
  strategicContext: string;
  recentTurnsStr: string;
  humanChoice?: { selectedCards: string[] } | undefined;
}) {
  const { currentState, strategicContext, recentTurnsStr, humanChoice } =
    params;
  return {
    rules: GAME_RULES,
    decisionGuidance: DECISION_GUIDANCE,
    cardReference: buildCardReference(currentState.supply),
    decisionPlayer: getDecisionPlayerId(currentState),
    currentState: encodeToon(optimizeStateForAI(currentState)),
    strategicContext,
    ...(recentTurnsStr ? { recentTurns: recentTurnsStr } : {}),
    ...(currentState.turnHistory.length > 0
      ? { actionsThisTurn: encodeToon(currentState.turnHistory) }
      : {}),
    ...(humanChoice
      ? { humanChoice: encodeToon(humanChoice.selectedCards) }
      : {}),
  };
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
