import { describe, it, expect } from "bun:test";
import { dominionGame } from "./definition";
import { fixture } from "./test-fixture";

describe("dominionGame", () => {
  it("names the active player, then the pending choice owner, then nobody", () => {
    const engine = fixture(["Militia", "Copper", "Copper", "Estate", "Estate"]);
    expect(dominionGame.whoMustAct(engine.state)).toBe("alice");
    engine.playAction("alice", "Militia");
    expect(dominionGame.whoMustAct(engine.state)).toBe("bob");
    expect(
      dominionGame.whoMustAct({ ...engine.state, gameOver: true }),
    ).toBeNull();
  });

  it("maps a play move to a decision answer while a decision is pending", () => {
    const engine = fixture([
      "Throne Room",
      "Bandit",
      "Estate",
      "Copper",
      "Copper",
    ]);
    engine.playAction("alice", "Throne Room");
    const moves = dominionGame.legalMoves(engine.state, "alice");
    expect(moves).toEqual([
      { type: "play_action", card: "Bandit" },
      { type: "skip_decision" },
    ]);
    expect(
      dominionGame.moveToCommand(engine.state, moves[0]!, "alice"),
    ).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: { selectedCards: ["Bandit"] },
    });
  });

  it("maps a play move to PLAY_ACTION with no decision pending", () => {
    const engine = fixture(["Village", "Copper", "Copper", "Estate", "Estate"]);
    expect(
      dominionGame.moveToCommand(
        engine.state,
        { type: "play_action", card: "Village" },
        "alice",
      ),
    ).toEqual({ type: "PLAY_ACTION", playerId: "alice", card: "Village" });
  });

  it("auto-plays one simple treasure per step in the buy phase", () => {
    const engine = fixture(["Copper", "Silver", "Estate", "Estate", "Estate"]);
    engine.endPhase("alice");
    const moves = dominionGame.legalMoves(engine.state, "alice");
    expect(dominionGame.autoMove?.(engine.state, "alice", moves)).toEqual({
      type: "play_treasure",
      card: "Copper",
    });
    engine.playAllTreasures("alice");
    expect(
      dominionGame.autoMove?.(
        engine.state,
        "alice",
        dominionGame.legalMoves(engine.state, "alice"),
      ),
    ).toBeUndefined();
  });

  it("keys votes by move without reasoning and renders prompt rows", () => {
    expect(
      dominionGame.moveKey({ type: "buy_card", card: "Gold", reasoning: "x" }),
    ).toBe(dominionGame.moveKey({ type: "buy_card", card: "Gold" }));
    expect(dominionGame.promptRow({ type: "buy_card", card: "Gold" })).toEqual({
      type: "buy_card",
      card: "Gold",
    });
    expect(dominionGame.promptRow({ type: "end_phase" })).toEqual({
      type: "end_phase",
      card: "",
    });
    expect(dominionGame.describeMove({ type: "buy_card", card: "Gold" })).toBe(
      "buy_card(Gold)",
    );
  });

  it("builds the viewer log context", () => {
    const engine = fixture(["Village", "Copper", "Copper", "Estate", "Estate"]);
    const ctx = dominionGame.logContext(
      engine.state,
      "alice",
      dominionGame.legalMoves(engine.state, "alice"),
    );
    expect(ctx.turnId).toBe("alice-1");
    expect(ctx.isChoice).toBe(false);
    expect(ctx.payload).toMatchObject({
      turn: 1,
      phase: "action",
      hand: ["Village", "Copper", "Copper", "Estate", "Estate"],
    });
    engine.playAction("alice", "Village");
    engine.endPhase("alice");
    engine.endPhase("alice");
    expect(dominionGame.logContext(engine.state, "bob", []).turnId).toBe(
      "bob-2",
    );
  });
});
