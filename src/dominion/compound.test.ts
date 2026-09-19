import { describe, it, expect } from "bun:test";
import { dominionCompound } from "./compound";
import { fixture } from "./test-fixture";
import type { Action } from "../types/action";
import type { CardName } from "../types/game-state";

describe("dominionCompound", () => {
  it("returns null for a single-card decision", () => {
    const engine = fixture([
      "Throne Room",
      "Bandit",
      "Estate",
      "Copper",
      "Copper",
    ]);
    engine.playAction("alice", "Throne Room");
    expect(dominionCompound(engine.state, "alice")).toBeNull();
  });

  it("votes card by card for Chapel and submits the picks", () => {
    const engine = fixture(["Chapel", "Estate", "Estate", "Copper", "Curse"]);
    engine.playAction("alice", "Chapel");
    const plan = dominionCompound(engine.state, "alice");
    expect(plan).not.toBeNull();
    if (!plan) return;
    const r0 = plan.round([]);
    expect(
      r0?.moves.map(m => (m.type === "choose_from_options" ? "?" : m.card)),
    ).toEqual(["Estate", "Estate", "Copper", "Curse", undefined]);
    const estate: Action = { type: "trash_card", card: "Estate" };
    const r1 = plan.round([estate]);
    expect(
      r1?.moves.filter(m => m.type === "trash_card" && m.card === "Estate"),
    ).toHaveLength(1);
    expect(plan.endsRounds({ type: "skip_decision" })).toBe(true);
    expect(plan.endsRounds(estate)).toBe(false);
    const command = plan.finish([
      estate,
      { type: "trash_card", card: "Curse" },
    ]);
    expect(command).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: { selectedCards: ["Estate", "Curse"] },
    });
    expect(engine.dispatch(command, "alice").ok).toBe(true);
  });

  it("stops offering rounds at max picks", () => {
    const engine = fixture(["Chapel", "Estate", "Estate", "Copper", "Curse"]);
    engine.playAction("alice", "Chapel");
    const plan = dominionCompound(engine.state, "alice");
    const cards: CardName[] = ["Estate", "Estate", "Copper", "Curse"];
    const four: Action[] = cards.map(card => ({ type: "trash_card", card }));
    expect(plan?.round(four)).toBeNull();
  });

  it("votes per card for Sentry and fills defaults for unvoted cards", () => {
    const engine = fixture(["Sentry", "Copper", "Copper", "Estate", "Estate"], {
      deck: ["Curse", "Estate", "Gold", "Silver", "Copper"],
    });
    engine.playAction("alice", "Sentry");
    const plan = dominionCompound(engine.state, "alice");
    expect(plan).not.toBeNull();
    if (!plan) return;
    const r0 = plan.round([]);
    expect(r0?.moves.map(m => m.type)).toEqual([
      "topdeck_card",
      "trash_card",
      "discard_card",
      "skip_decision",
    ]);
    expect(
      plan.round([
        { type: "trash_card", card: "Copper" },
        { type: "trash_card", card: "Curse" },
      ]),
    ).toBeNull();
    const command = plan.finish([{ type: "trash_card", card: "Copper" }]);
    expect(command).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: {
        selectedCards: [],
        cardActions: { 0: "trash_card", 1: "topdeck_card" },
        cardOrder: [1],
      },
    });
    expect(engine.dispatch(command, "alice").ok).toBe(true);
  });
});
