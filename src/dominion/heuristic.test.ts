import { describe, it, expect } from "bun:test";
import { dominionHeuristic } from "./heuristic";
import { fixture } from "./test-fixture";

describe("dominionHeuristic", () => {
  it("plays Village before Smithy", () => {
    const engine = fixture(["Smithy", "Village", "Copper", "Copper", "Estate"]);
    expect(dominionHeuristic(engine.state, "alice")).toEqual({
      type: "PLAY_ACTION",
      playerId: "alice",
      card: "Village",
    });
  });

  it("ends the action phase with no playable action", () => {
    const engine = fixture(["Copper", "Copper", "Copper", "Estate", "Estate"]);
    expect(dominionHeuristic(engine.state, "alice")).toEqual({
      type: "END_PHASE",
      playerId: "alice",
    });
  });

  it("plays treasures, then buys by priority, then ends the buy phase", () => {
    const engine = fixture(["Copper", "Copper", "Silver", "Estate", "Estate"]);
    engine.endPhase("alice");
    expect(dominionHeuristic(engine.state, "alice")).toEqual({
      type: "PLAY_ALL_TREASURES",
      playerId: "alice",
    });
    engine.playAllTreasures("alice");
    expect(dominionHeuristic(engine.state, "alice")).toEqual({
      type: "BUY_CARD",
      playerId: "alice",
      card: "Silver",
    });
    engine.buyCard("alice", "Silver");
    expect(dominionHeuristic(engine.state, "alice")).toEqual({
      type: "END_PHASE",
      playerId: "alice",
    });
  });

  it("discards Estates first when attacked", () => {
    const engine = fixture(
      ["Militia", "Copper", "Copper", "Estate", "Estate"],
      {
        bobHand: ["Copper", "Copper", "Estate", "Estate", "Gold"],
      },
    );
    engine.playAction("alice", "Militia");
    expect(dominionHeuristic(engine.state, "bob")).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "bob",
      choice: { selectedCards: ["Estate", "Estate"] },
    });
  });

  it("reveals Moat against an attack", () => {
    const engine = fixture(
      ["Militia", "Copper", "Copper", "Estate", "Estate"],
      {
        bobHand: ["Moat", "Copper", "Estate", "Estate", "Gold"],
      },
    );
    engine.playAction("alice", "Militia");
    expect(dominionHeuristic(engine.state, "bob")).toEqual({
      type: "REVEAL_REACTION",
      playerId: "bob",
      card: "Moat",
    });
  });

  it("takes the default action for every card of a per-card decision", () => {
    const engine = fixture(["Sentry", "Copper", "Copper", "Estate", "Estate"], {
      deck: ["Curse", "Estate", "Gold", "Silver", "Copper"],
    });
    engine.playAction("alice", "Sentry");
    const command = dominionHeuristic(engine.state, "alice");
    expect(command.type).toBe("SUBMIT_DECISION");
    if (command.type !== "SUBMIT_DECISION") return;
    expect(command.choice.cardActions).toEqual({
      0: "topdeck_card",
      1: "topdeck_card",
    });
    expect(command.choice.cardOrder).toEqual([0, 1]);
    expect(engine.dispatch(command, "alice").ok).toBe(true);
  });
});
