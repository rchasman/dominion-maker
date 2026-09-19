import { describe, it, expect } from "bun:test";
import {
  buildJevQuestion,
  buildJevState,
  jevAnswerToAction,
} from "./jev-choice";
import type { Action } from "../types/action";
import type { GameState } from "../types/game-state";

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

describe("buildJevQuestion", () => {
  const question = buildJevQuestion(LEGAL);

  it("offers one numbered option per legal action, so duplicate cards stay distinct", () => {
    expect(Object.keys(question.criteria)).toEqual([
      "1. play treasure Copper",
      "2. play treasure Copper",
      "3. buy Silver",
      "4. end phase",
    ]);
  });

  it("describes card options with the printed card effect", () => {
    expect(question.criteria["3. buy Silver"]).toContain("Silver");
    expect(question.criteria["3. buy Silver"]).toContain("cost 3");
  });

  it("tells the model treasures must be played before buying", () => {
    expect(question.criteria["1. play treasure Copper"]).toContain(
      "before buying",
    );
  });

  it("asks a single literal question about the decision player", () => {
    expect(question.type).toBe("choice");
    expect(question.instructions).toContain("`you`");
  });
});

describe("buildJevState", () => {
  it("packs rules, card reference, projected state and strategy under named fields", () => {
    const state = buyPhaseState();
    const jevState = buildJevState({
      currentState: state,
      strategicContext: "gameplan: money",
      recentTurnsStr: "",
    });

    expect(jevState.rules).toContain("WIN CONDITION");
    expect(jevState.cardReference).toContain("CARD DEFINITIONS");
    expect(jevState.strategicContext).toBe("gameplan: money");
    expect(jevState.currentState).toContain("currentGameStage");
    expect(jevState).not.toHaveProperty("recentTurns");
    expect(jevState).not.toHaveProperty("humanChoice");
  });

  it("includes the human choice when one was made", () => {
    const state = buyPhaseState();
    const jevState = buildJevState({
      currentState: state,
      strategicContext: "",
      recentTurnsStr: "turn 1: ...",
      humanChoice: { selectedCards: ["Moat"] },
    });

    expect(jevState.recentTurns).toBe("turn 1: ...");
    expect(jevState.humanChoice).toContain("Moat");
  });
});

describe("jevAnswerToAction", () => {
  it("maps the chosen option back to the legal action by its number", () => {
    const action = jevAnswerToAction(
      {
        type: "choice",
        choice: "3. buy Silver",
        probabilities: {
          "1. play treasure Copper": 0.1,
          "2. play treasure Copper": 0.1,
          "3. buy Silver": 0.7,
          "4. end phase": 0.1,
        },
      },
      LEGAL,
    );

    expect(action.type).toBe("buy_card");
    expect(action).toHaveProperty("card", "Silver");
  });

  it("summarises the distribution as the reasoning, runner-up included", () => {
    const action = jevAnswerToAction(
      {
        type: "choice",
        choice: "3. buy Silver",
        probabilities: {
          "1. play treasure Copper": 0.05,
          "2. play treasure Copper": 0.05,
          "3. buy Silver": 0.7,
          "4. end phase": 0.2,
        },
      },
      LEGAL,
    );

    expect(action.reasoning).toBe(
      "Jev picked this with 70% probability. Runner-up: end phase (20%).",
    );
  });

  it("states the pick alone when no distribution is returned", () => {
    const action = jevAnswerToAction(
      { type: "choice", choice: "4. end phase" },
      LEGAL,
    );

    expect(action.type).toBe("end_phase");
    expect(action.reasoning).toBe("Jev picked this option.");
  });

  it("throws when the choice is not one of the offered options", () => {
    expect(() =>
      jevAnswerToAction({ type: "choice", choice: "9. buy Gold" }, LEGAL),
    ).toThrow("not an offered option");
  });
});
