import { expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import { projectState } from "../events/project";

it("reproduces kingdom selection and starting decks from a seed", () => {
  const first = new DominionEngine();
  const second = new DominionEngine();
  first.startGame(["human", "ai"], undefined, 2026);
  second.startGame(["human", "ai"], undefined, 2026);
  expect(first.state.kingdomCards).toEqual(second.state.kingdomCards);
  expect(first.state.players).toEqual(second.state.players);
  expect(first.state.randomState).toEqual(second.state.randomState);
});

it("forks and reloads the random stream without consuming the original", () => {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], ["Smithy"], 17);
  engine.applyExternalEvents([
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "human",
      cards: ["Smithy", "Copper", "Silver", "Gold", "Estate"],
    },
    {
      type: "INITIAL_HAND_DRAWN",
      playerId: "human",
      cards: ["Smithy", "Copper", "Silver", "Gold", "Estate"],
    },
    ...(["Copper", "Silver", "Gold", "Estate"] as const).map(card => ({
      type: "CARD_DISCARDED" as const,
      playerId: "human",
      card,
      from: "hand" as const,
    })),
  ]);
  const before = engine.serialize();
  const fork = engine.fork();
  const restored = DominionEngine.deserialize(engine.serialize());
  expect(fork.playAction("human", "Smithy").ok).toBe(true);
  expect(engine.serialize()).toBe(before);
  expect(restored.playAction("human", "Smithy").ok).toBe(true);
  expect(fork.state.players).toEqual(restored.state.players);
  expect(fork.state.randomState).toBe(restored.state.randomState);
  expect(fork.state).toEqual(projectState([...fork.eventLog]));
});

it("restores undo negotiation and rejects duplicate or self approvals", () => {
  let engine = new DominionEngine();
  engine.startGame(["human", "first", "second"], ["Village"], 42);
  const target = engine.eventLog.find(
    event => event.type === "TURN_STARTED",
  )!.id!;
  expect(
    engine.dispatch(
      { type: "REQUEST_UNDO", playerId: "human", toEventId: target },
      "human",
    ).ok,
  ).toBe(true);
  const request = engine.undoRequest!.requestId;
  expect(engine.approveUndo("human", request).ok).toBe(false);
  expect(engine.approveUndo("outsider", request).ok).toBe(false);
  expect(engine.approveUndo("first", request).ok).toBe(true);
  engine = DominionEngine.deserialize(engine.serialize());
  expect([...engine.undoRequest!.approvals]).toEqual(["first"]);
  expect(engine.approveUndo("first", request).ok).toBe(false);
  expect(engine.approveUndo("second", request).ok).toBe(true);
  expect(engine.undoRequest).toBeNull();
});

it("rewinds a completed nested resolution to an earlier suspended choice", () => {
  let engine = new DominionEngine();
  engine.startGame(["human", "ai"], ["Throne Room", "Workshop"], 42);
  engine.applyExternalEvents([
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "human",
      cards: ["Throne Room", "Workshop"],
    },
    {
      type: "INITIAL_HAND_DRAWN",
      playerId: "human",
      cards: ["Throne Room", "Workshop"],
    },
  ]);
  engine.playAction("human", "Throne Room");
  engine.submitDecision("human", { selectedCards: ["Workshop"] });
  const checkpoint = engine.eventLog.at(-1)!.id!;
  const suspended = structuredClone(engine.state);
  engine.submitDecision("human", { selectedCards: ["Silver"] });
  engine.submitDecision("human", { selectedCards: ["Silver"] });
  engine.undoToEvent(checkpoint);
  expect(engine.state).toEqual(suspended);
  engine = DominionEngine.deserialize(engine.serialize());
  expect(engine.submitDecision("human", { selectedCards: ["Estate"] }).ok).toBe(
    true,
  );
  expect(engine.submitDecision("human", { selectedCards: ["Estate"] }).ok).toBe(
    true,
  );
  expect(engine.state.players.human!.discard).toEqual(["Estate", "Estate"]);
  expect(engine.state.executionStack).toEqual([]);
});
