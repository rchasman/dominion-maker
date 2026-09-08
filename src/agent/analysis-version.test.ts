import { describe, expect, it } from "bun:test";
import { createGame } from "../engine";
import { analysisVersion, isAnalysisApplicable } from "./analysis-version";
import { buildStrategicContext } from "./strategic-context";

describe("analysis version", () => {
  it("accepts forward progress, labels age and rejects other games", () => {
    const state = createGame(["human", "ai"], undefined, 42).state;
    const version = analysisVersion(state);
    expect(isAnalysisApplicable(version, state)).toBe(true);
    const advanced = { ...state, turn: state.turn + 2 };
    const summary = JSON.stringify({
      human: {
        gameplan: "versioned plan",
        read: "read",
        recommendation: "recommendation",
        analysis: version,
      },
    });
    expect(buildStrategicContext(advanced, summary)).toContain(
      "analysisAgeTurns: 2",
    );
    const other = createGame(["human", "ai"], undefined, 42).state;
    expect(isAnalysisApplicable(version, other)).toBe(false);
    expect(buildStrategicContext(other, summary)).toContain("No analysis yet");
  });

  it("rejects analysis from an undone nested event", () => {
    const state = createGame(["human", "ai"], undefined, 42).state;
    state.log = [
      ...state.log,
      {
        type: "play-action",
        playerId: "human",
        card: "Chapel",
        eventId: "parent",
        children: [
          {
            type: "trash-card",
            playerId: "human",
            card: "Estate",
            eventId: "undone",
          },
        ],
      },
    ];
    const version = analysisVersion(state);
    expect(version.sourceEventId).toBe("undone");
    state.log.at(-1)!.children = [];
    expect(isAnalysisApplicable(version, state)).toBe(false);
  });
});
