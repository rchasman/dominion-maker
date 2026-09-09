import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render } from "preact";
import { VotingPane } from "./VotingPane";
import type { ModelStatus } from "../types";

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

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

  it("does not report legality when legal actions are unavailable", () => {
    const root = document.createElement("div");
    render(<VotingPane data={null} liveStatuses={statuses()} />, root);
    expect(
      root.querySelector('[aria-label="Legality unchecked"]')?.textContent,
    ).toBe("—");
    expect(root.textContent).not.toContain("Legal action");
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
