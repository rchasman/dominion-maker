import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../../../happy-dom.test-fixture";
import { render } from "preact";
import { ReasoningPane } from "./ReasoningPane";
import type { ModelStatus } from "../types";
import type { Action } from "../../../types/action";

beforeAll(registerHappyDom);

/** A chess move reaches the pane typed as a Dominion Action and shaped like this */
const nf6: Action = JSON.parse('{"san":"Nf6","from":"g8","to":"f6"}');

const chessStatuses = (): Map<number, ModelStatus> =>
  new Map([
    [
      0,
      {
        provider: "gpt-5.4-nano" as const,
        index: 0,
        startTime: 0,
        completed: true,
        success: true,
        action: { ...nf6, reasoning: "Controls the centre" },
        key: "Nf6",
        label: "Nf6",
      },
    ],
  ]);

describe("ReasoningPane", () => {
  it("names a live chess vote by the words its own game gave it", () => {
    const root = document.createElement("div");
    render(
      <ReasoningPane votingData={null} modelStatuses={chessStatuses()} />,
      root,
    );
    expect(root.textContent).toContain("Nf6");
    expect(root.textContent).not.toContain("undefined");
    expect(root.textContent).not.toContain('"san"');
    render(null, root);
  });

  it("names a finished chess vote the same way", () => {
    const root = document.createElement("div");
    render(
      <ReasoningPane
        votingData={{
          topResult: {
            action: nf6,
            votes: 1,
            voters: [],
            valid: true,
            totalVotes: 1,
            completed: 1,
            percentage: "100%",
            earlyConsensus: false,
          },
          allResults: [
            {
              key: "Nf6",
              label: "Nf6",
              action: nf6,
              votes: 1,
              voters: [],
              valid: true,
            },
          ],
          votingDuration: 10,
          currentPhase: "action",
          gameState: JSON.parse("{}"),
        }}
      />,
      root,
    );
    expect(root.textContent).toContain("Nf6");
    expect(root.textContent).not.toContain("undefined");
    render(null, root);
  });
});
