import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../../../happy-dom.test-fixture";
import { render } from "preact";
import { VotingPane } from "./VotingPane";
import type { ModelStatus } from "../types";
import type { Action } from "../../../types/action";
import { stripReasoning } from "../../../types/action";

beforeAll(registerHappyDom);
/** Dominion's own move key, which is what the core stamps on each result */
const dominionKey = (action: Action) => JSON.stringify(stripReasoning(action));

const GOLD: Action = { type: "buy_card", card: "Gold" };

function statuses(): Map<number, ModelStatus> {
  return new Map(
    ["Economy", "Action balance"].map((reasoning, index) => [
      index,
      {
        provider: "gpt-5.4-nano",
        index,
        startTime: 0,
        completed: true,
        success: true,
        action: { type: "buy_card", card: "Gold", reasoning },
      },
    ]),
  );
}

describe("vote explanations", () => {
  it("attributes each live response to its provider", () => {
    const root = document.createElement("div");
    render(
      <VotingPane
        data={null}
        liveStatuses={statuses()}
        totalModels={4}
        legalKeys={[dominionKey(GOLD)]}
      />,
      root,
    );
    expect(
      root.querySelector('[aria-label="50% vote share"]')?.textContent,
    ).toBe("50%");
    expect(root.querySelector('[aria-label="Valid action"]')?.textContent).toBe(
      "✓",
    );
    expect(root.textContent).toContain("gpt-5.4-nano");
    const details = root.querySelector("details")!;
    expect(details.textContent).toContain("Action balance");
    expect(details.open).toBe(false);
    details.open = true;
    expect(details.open).toBe(true);
    render(null, root);
  });

  it("counts a model whose answer carried no probability mass", () => {
    const root = document.createElement("div");
    const empty = new Map(
      Array.from(statuses(), ([index, status]) => [
        index,
        { ...status, distribution: [] },
      ]),
    );
    render(
      <VotingPane
        data={null}
        liveStatuses={empty}
        totalModels={4}
        legalKeys={[dominionKey(GOLD)]}
      />,
      root,
    );
    expect(root.textContent).toContain("gpt-5.4-nano");
    expect(
      root.querySelector('[aria-label="50% vote share"]')?.textContent,
    ).toBe("50%");
    render(null, root);
  });

  it("does not report legality when legal actions are unavailable", () => {
    const root = document.createElement("div");
    render(<VotingPane data={null} liveStatuses={statuses()} />, root);
    expect(
      root.querySelector('[aria-label="Legality unchecked"]')?.textContent,
    ).toBe("—");
    expect(root.textContent).not.toContain("Legal action");
    render(null, root);
  });

  it("judges a chess vote by its own move key", () => {
    // The pane types every game's move as a Dominion Action, so a chess move
    // reaches it shaped like this, keyed by the SAN its own game chose
    const nc6: Action = JSON.parse('{"san":"Nc6","from":"b8","to":"c6"}');
    const nf6: Action = JSON.parse('{"san":"Nf6","from":"g8","to":"f6"}');
    const chessStatus = (index: number, action: Action, key: string) => ({
      provider: "gpt-5.4-nano" as const,
      index,
      startTime: 0,
      completed: true,
      success: true,
      action,
      key,
      distribution: [
        { move: action, weight: 0.75, key },
        { move: nf6, weight: 0.25, key: "Nf6" },
      ],
    });
    const root = document.createElement("div");
    render(
      <VotingPane
        data={null}
        liveStatuses={
          new Map([
            [0, chessStatus(0, nc6, "Nc6")],
            [1, chessStatus(1, nc6, "Nc6")],
          ])
        }
        totalModels={2}
        legalKeys={["Nc6", "Nf6"]}
      />,
      root,
    );
    expect(root.querySelector('[aria-label="Invalid action"]')).toBeNull();
    expect(root.querySelectorAll('[aria-label="Valid action"]').length).toBe(2);
    expect(
      root.querySelector('[aria-label="75% vote share"]')?.textContent,
    ).toBe("75%");
    expect(
      root.querySelector('[aria-label="25% vote share"]')?.textContent,
    ).toBe("25%");
    render(null, root);
  });

  it("calls a chess move illegal only when its key is not legal", () => {
    const ke2: Action = JSON.parse('{"san":"Ke2","from":"e1","to":"e2"}');
    const root = document.createElement("div");
    render(
      <VotingPane
        data={null}
        liveStatuses={
          new Map([
            [
              0,
              {
                provider: "gpt-5.4-nano" as const,
                index: 0,
                startTime: 0,
                completed: true,
                success: true,
                action: ke2,
                key: "Ke2",
                distribution: [],
              },
            ],
          ])
        }
        legalKeys={["Nc6", "Nf6"]}
      />,
      root,
    );
    expect(
      root.querySelector('[aria-label="Invalid action"]')?.textContent,
    ).toBe("✗");
    render(null, root);
  });

  it("marks an illegal action with a cross", () => {
    const root = document.createElement("div");
    render(
      <VotingPane data={null} liveStatuses={statuses()} legalKeys={[]} />,
      root,
    );
    expect(
      root.querySelector('[aria-label="Invalid action"]')?.textContent,
    ).toBe("✗");
    render(null, root);
  });
});
