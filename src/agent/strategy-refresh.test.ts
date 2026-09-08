import { expect, it } from "bun:test";
import { createGame } from "../engine";
import { api } from "../api/client";
import { runAITurnWithConsensus } from "./game-agent";

it("uses an analysis arriving mid-turn for the next decision", async () => {
  const engine = createGame(["human", "ai"], undefined, 42);
  engine.state.phase = "buy";
  engine.state.coins = 6;
  engine.state.buys = 2;
  engine.state.players.human!.hand = [];
  const summaries: { current: string; seen: Array<string | undefined> } = {
    current: "old",
    seen: [],
  };
  const original = api.api["generate-action"].post;
  api.api["generate-action"].post = body => {
    summaries.seen = [...summaries.seen, body.strategySummary];
    summaries.current = "updated";
    return Promise.resolve({
      data: {
        action:
          summaries.seen.length === 1
            ? { type: "buy_card", card: "Silver" }
            : { type: "end_phase" },
      },
      error: null,
    });
  };
  try {
    await runAITurnWithConsensus(engine, "human", {
      providers: ["gpt-5.4-mini"],
      getStrategySummary: () => summaries.current,
    });
    expect(summaries.seen).toEqual(["old", "updated"]);
    expect(engine.state.activePlayerId).toBe("ai");
  } finally {
    api.api["generate-action"].post = original;
  }
});
