import { describe, it, expect } from "bun:test";
import { decisionSummary, optionFacts } from "./jev-decision-facts";
import { jevCases } from "./evals/jev-cases";

const caseState = (id: string) => {
  const found = jevCases().find(c => c.id === id);
  if (!found) throw new Error(`missing case ${id}`);
  return found.state;
};

describe("decisionSummary", () => {
  it("names the score position and game-end proximity instead of leaving Jev to subtract", () => {
    const behind = decisionSummary(caseState("endgame-behind-dont-end"));
    expect(behind.scorePosition).toBe("behind by one Province or more");
    expect(behind.gameEnd).toBe(
      "at least one purchase available right now ends the game",
    );

    const opening = decisionSummary(caseState("open-4"));
    expect(opening.scorePosition).toBe("tied on victory points");
    expect(opening.gameEnd).toBe(
      "no purchase available right now ends the game",
    );
    expect(opening).not.toHaveProperty("deckMoney");

    expect(decisionSummary(caseState("militia-discard")).gameEnd).toBe(
      "no purchase is being decided right now",
    );
  });
});

describe("optionFacts", () => {
  it("spells out that buying the last Province ends the game and who wins", () => {
    const behind = caseState("endgame-behind-dont-end");
    expect(optionFacts(behind, { type: "buy_card", card: "Province" })).toBe(
      "Buying this ENDS THE GAME immediately and YOU LOSE on final score.",
    );
    const ahead = caseState("endgame-ahead-end-it");
    expect(
      optionFacts(ahead, { type: "buy_card", card: "Province" }),
    ).toContain("YOU WIN");
    expect(optionFacts(ahead, { type: "buy_card", card: "Duchy" })).toBeNull();
  });

  it("marks terminal actions as spending the last action and +Action cards as go-first", () => {
    const state = caseState("village-before-smithy");
    expect(
      optionFacts(state, { type: "play_action", card: "Smithy" }),
    ).toContain("spends your last action");
    expect(
      optionFacts(state, { type: "play_action", card: "Village" }),
    ).toContain("+2 Actions");
  });

  it("says when a pile a card's text names is empty, for any card", () => {
    const state = caseState("empty-curses-no-witch");
    expect(optionFacts(state, { type: "buy_card", card: "Witch" })).toBe(
      "The Curse pile is empty, so the part of this card that gives Curse does nothing.",
    );
    expect(optionFacts(state, { type: "buy_card", card: "Market" })).toBeNull();
    expect(
      optionFacts(caseState("open-4"), { type: "buy_card", card: "Witch" }),
    ).toBeNull();
  });

  it("has nothing to add for actions without a card", () => {
    expect(optionFacts(caseState("open-4"), { type: "end_phase" })).toBeNull();
  });
});
