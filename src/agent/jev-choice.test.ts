import { describe, it, expect } from "bun:test";
import {
  buildJevQuestion,
  buildJevState,
  describeGameRead,
  buildJevReadQuestions,
  buildJevVerifyQuestions,
  GAME_PHASE_LEVELS,
} from "./jev-choice";
import { jevQuestions, type JevChoiceQuestion } from "./jev-protocol";
import type { Action } from "../types/action";
import type { GameState } from "../types/game-state";
import { CARDS } from "../data/cards";

const keysOf = (question: JevChoiceQuestion<Action>): string[] =>
  question.options.map(option => option.key);

const descriptionOf = (
  question: JevChoiceQuestion<Action>,
  key: string,
): string | null => {
  const option = question.options.find(candidate => candidate.key === key);
  if (!option) throw new Error(`${key} was not offered`);
  return option.description;
};

const LEGAL: Action[] = [
  { type: "play_treasure", card: "Copper" },
  { type: "play_treasure", card: "Copper" },
  { type: "buy_card", card: "Silver" },
  { type: "end_phase" },
];

const emptyPlayer = () => ({
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  inPlaySourceIndices: [],
});

const supply: Record<string, number> = { Copper: 40, Silver: 40, Province: 8 };

const buyPhaseState = (): GameState => ({
  players: {
    ai: { ...emptyPlayer(), hand: ["Copper", "Copper"] },
    human: emptyPlayer(),
  },
  activePlayerId: "ai",
  turn: 3,
  phase: "buy",
  actions: 0,
  buys: 1,
  coins: 0,
  supply,
  trash: [],
  log: [],
  gameOver: false,
  winnerId: null,
  turnHistory: [],
  kingdomCards: [],
  pendingChoice: null,
  pendingChoiceEventId: null,
  activeEffects: [],
  playerOrder: ["ai", "human"],
});

const NO_TREASURES_LEFT: Action[] = [
  { type: "buy_card", card: "Silver" },
  { type: "buy_card", card: "Chapel" },
  { type: "end_phase" },
];

describe("buildJevQuestion", () => {
  const question = buildJevQuestion(buyPhaseState(), NO_TREASURES_LEFT);

  it("offers one numbered option per legal action once treasures are played", () => {
    expect(keysOf(question)).toEqual([
      "1. buy Silver",
      "2. buy Chapel",
      "3. end phase",
    ]);
    expect(question.options.map(option => option.move)).toEqual(
      NO_TREASURES_LEFT,
    );
  });

  it("offers only treasure plays while any treasure is still in hand, with duplicates distinct", () => {
    const withTreasures = buildJevQuestion(buyPhaseState(), LEGAL);
    expect(keysOf(withTreasures)).toEqual([
      "1. play treasure Copper",
      "2. play treasure Copper",
    ]);
  });

  it("describes card options with the printed card effect", () => {
    expect(descriptionOf(question, "1. buy Silver")).toContain("Silver");
    expect(descriptionOf(question, "1. buy Silver")).toContain("cost 3");
  });

  it("asks the buy-phase question with the coins and buys spelled out", () => {
    expect(question.instructions).toContain("Buy phase with 0 coins and 1 buy");
    expect(question.instructions).toContain("`currentState.you`");
  });

  it("sends the same choice question and companions the endpoint always sent", () => {
    const sent = jevQuestions(question, buildJevReadQuestions());
    expect(Object.keys(sent)).toEqual([
      "action",
      "gamePhase",
      "opponentDeckStronger",
    ]);
    expect(sent.action).toEqual({
      type: "choice",
      instructions: question.instructions,
      criteria: {
        "1. buy Silver": descriptionOf(question, "1. buy Silver"),
        "2. buy Chapel": descriptionOf(question, "2. buy Chapel"),
        "3. end phase": descriptionOf(question, "3. end phase"),
      },
    });
    expect(sent.action.criteria["3. end phase"]).toContain(
      "Moves to the next phase",
    );
  });

  it("asks a treasure question while treasures remain", () => {
    const withTreasures = buildJevQuestion(buyPhaseState(), LEGAL);
    expect(withTreasures.instructions).toContain(
      "Which treasure should you play",
    );
  });

  it("asks a reaction question with the attacking card named", () => {
    const state: GameState = {
      ...buyPhaseState(),
      activePlayerId: "human",
      phase: "action",
      pendingChoice: {
        choiceType: "reaction",
        playerId: "ai",
        triggeringPlayerId: "human",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      },
    };
    const reaction = buildJevQuestion(state, [
      { type: "reveal_reaction", card: "Moat" },
      { type: "decline_reaction" },
    ]);
    expect(reaction.instructions).toContain("An opponent played Militia");
  });

  it("asks a decision question with the intent verb and skip allowance", () => {
    const state: GameState = {
      ...buyPhaseState(),
      phase: "action",
      pendingChoice: {
        choiceType: "decision",
        playerId: "ai",
        prompt: "Trash up to 4 cards",
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 4,
        cardOptions: ["Copper", "Estate"],
        intent: "trash",
        from: "hand",
      },
    };
    const decision = buildJevQuestion(state, [
      { type: "trash_card", card: "Copper" },
      { type: "trash_card", card: "Estate" },
      { type: "skip_decision" },
    ]);
    expect(decision.instructions).toContain("Chapel asks you to trash a card");
    expect(decision.instructions).toContain("Skipping is allowed");
  });
});

describe("buildJevQuestion option advice", () => {
  it("puts the card's strategy advice on the option so Jev needs no lookup", () => {
    const question = buildJevQuestion(buyPhaseState(), NO_TREASURES_LEFT);
    expect(descriptionOf(question, "1. buy Silver")).toContain("Advice:");
    expect(descriptionOf(question, "1. buy Silver")).toContain(
      CARDS.Silver.strategy,
    );
  });
});

describe("buildJevState", () => {
  it("sends plain JSON objects, not TOON strings", () => {
    const jevState = buildJevState({ currentState: buyPhaseState() });

    expect(typeof jevState).toBe("object");
    if (
      jevState === null ||
      typeof jevState !== "object" ||
      Array.isArray(jevState)
    ) {
      throw new Error("state must be an object");
    }
    expect(jevState.rules).toContain("WIN CONDITION");
    expect(jevState.ruleAuthority).toContain("RULE AUTHORITY");
    expect(Array.isArray(jevState.cardDefinitions)).toBe(true);
    expect(jevState).not.toHaveProperty("cardStrategyAdvice");
    // Doctrine goes to the strategy analyst, not to Jev: measured 15/15 -> 14/15
    expect(jevState).not.toHaveProperty("principles");
    expect(jevState.currentState).toMatchObject({
      you: { currentCoins: 0, currentPhase: "buy" },
    });
    expect(jevState.strategy).toMatchObject({
      aiDecisionPlan: { priority: expect.any(String) },
    });
    expect(jevState).not.toHaveProperty("recentTurns");
    expect(jevState).not.toHaveProperty("humanChoice");
    expect(JSON.stringify(jevState)).not.toContain("\t");
  });

  it("carries the custom strategy override when given", () => {
    const jevState = buildJevState({
      currentState: buyPhaseState(),
      customStrategy: "Always buy Province at $8",
    });

    expect(jevState).toMatchObject({
      strategy: { strategyOverride: "Always buy Province at $8" },
    });
  });
});

describe("game read companions", () => {
  it("asks a three-level phase score and an opponent-strength boolean", () => {
    const questions = buildJevReadQuestions();
    expect(questions.gamePhase.type).toBe("score");
    expect(questions.gamePhase.criteria).toHaveLength(3);
    expect(GAME_PHASE_LEVELS[2]).toContain("green");
    expect(questions.opponentDeckStronger.type).toBe("boolean");
  });

  it("names the nearest phase and the opponent probability on one line", () => {
    expect(
      describeGameRead({ gamePhase: 1.3, opponentDeckStronger: 0.31 }),
    ).toBe(
      "Game read: transition phase (1.3 of 2); opponent's deck stronger: 31%.",
    );
    expect(
      describeGameRead({ gamePhase: 0.2, opponentDeckStronger: 0.9 }),
    ).toContain("build phase");
  });
});

describe("buildJevVerifyQuestions", () => {
  it("always asks about a blunder and only asks about the override when one exists", () => {
    expect(Object.keys(buildJevVerifyQuestions(false))).toEqual(["blunder"]);
    expect(Object.keys(buildJevVerifyQuestions(true))).toEqual([
      "blunder",
      "followsOverride",
    ]);
    expect(buildJevVerifyQuestions(true).blunder.instructions).toContain(
      "`proposedAction`",
    );
  });
});
