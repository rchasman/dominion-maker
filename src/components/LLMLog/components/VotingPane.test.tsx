import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../../../happy-dom.test-fixture";
import { render } from "preact";
import { VotingPane } from "./VotingPane";
import type { ModelStatus } from "../types";
import type { Action } from "../../../types/action";

beforeAll(registerHappyDom);
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
        legalActions={["buy_card(Gold)"]}
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
        legalActions={["buy_card(Gold)"]}
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

  it("leaves legality unchecked for a move it cannot name", () => {
    // The pane types every game's move as a Dominion Action, so a chess move
    // reaches it shaped like this and no Dominion formatting fits it
    const chessMove: Action = JSON.parse('{"san":"Nc6","from":"b8","to":"c6"}');
    const root = document.createElement("div");
    render(
      <VotingPane
        data={null}
        liveStatuses={
          new Map([
            [
              0,
              {
                provider: "gpt-5.4-nano",
                index: 0,
                startTime: 0,
                completed: true,
                success: true,
                action: chessMove,
                distribution: [],
              },
            ],
          ])
        }
        legalActions={["Nc6", "Nf6"]}
      />,
      root,
    );
    expect(
      root.querySelector('[aria-label="Legality unchecked"]')?.textContent,
    ).toBe("—");
    expect(root.querySelector('[aria-label="Invalid action"]')).toBeNull();
    render(null, root);
  });

  it("marks an illegal action with a cross", () => {
    const root = document.createElement("div");
    render(
      <VotingPane data={null} liveStatuses={statuses()} legalActions={[]} />,
      root,
    );
    expect(
      root.querySelector('[aria-label="Invalid action"]')?.textContent,
    ).toBe("✗");
    render(null, root);
  });
});
