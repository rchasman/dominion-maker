import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../../../happy-dom.test-fixture";
import { render } from "preact";
import { DecisionAction } from "./DecisionAction";
import type { ConsensusDecision, ModelStatus, Turn } from "../types";
import type { LLMLogEntry } from "../types";

beforeAll(registerHappyDom);

const votingEntry: LLMLogEntry = {
  id: "v1",
  timestamp: 0,
  type: "consensus-voting",
  message: "",
  data: {},
};

const statuses = (usage?: {
  inputTokens: number;
  outputTokens: number;
}): Map<number, ModelStatus> =>
  new Map([
    [
      0,
      {
        provider: "claude-haiku" as const,
        index: 0,
        startTime: 0,
        completed: true,
        success: true,
        ...(usage ? { usage } : {}),
      },
    ],
  ]);

function renderDecision(decision: ConsensusDecision): string {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const turn: Turn = { turnNumber: 1, gameTurn: 1, decisions: [decision] };
  render(
    <DecisionAction
      currentTurn={turn}
      currentDecision={decision}
      currentActionIndex={0}
      activePane="voting"
      setActivePane={() => {}}
      hasPrevAction={false}
      hasNextAction={false}
      handlePrevAction={() => {}}
      handleNextAction={() => {}}
      now={0}
    />,
    container,
  );
  return container.textContent ?? "";
}

describe("decision cost", () => {
  it("shows what the decision cost beside how long it took", () => {
    const text = renderDecision({
      id: "d1",
      votingEntry: { ...votingEntry, data: { votingDuration: 1800 } },
      stepNumber: 1,
      modelStatuses: statuses({ inputTokens: 2000, outputTokens: 200 }),
    });
    // claude-haiku at $1/1M in and $5/1M out: 0.002 + 0.001
    expect(text).toContain("1.80s · $0.0030");
  });

  it("shows the timing alone when no model reported usage", () => {
    const text = renderDecision({
      id: "d2",
      votingEntry,
      stepNumber: 1,
      modelStatuses: statuses(),
    });
    expect(text).toContain("0.00s");
    expect(text).not.toContain("$");
  });
});
