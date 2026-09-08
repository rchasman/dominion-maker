import { expect, it } from "bun:test";
import { DominionEngine } from "./engine";
import { runExecution } from "./execute";
import { resumeExecution } from "./resume";
import { getCardEffect } from "../cards/base";
import { defineEffect, noMemory, schedule } from "../cards/program";
import { applyEvents } from "../events/apply";
import type { CardName, GameState } from "../types/game-state";
import type { CardOperation } from "../cards/program";

function begin(operations: CardOperation[]) {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai1", "ai2"], ["Workshop", "Bandit"]);
  const state: GameState = {
    ...engine.state,
    players: Object.fromEntries(
      ["human", "ai1", "ai2"].map(player => [
        player,
        {
          hand: player === "human" ? ["Workshop"] : [],
          deck: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      ]),
    ),
  };
  const parent = defineEffect(noMemory, () => schedule(operations));
  const registry = (card: CardName) =>
    card === "Bandit" ? parent : getCardEffect(card);
  const events = runExecution(
    state,
    [
      {
        type: "effect",
        card: "Bandit",
        playerId: "human",
        cause: "parent",
        trigger: { type: "play" },
      },
    ],
    () => 0.5,
    undefined,
    registry,
  );
  return {
    events,
    state: JSON.parse(JSON.stringify(applyEvents(state, events))) as GameState,
  };
}
const play: CardOperation = {
  type: "play",
  card: "Workshop",
  playerId: "human",
  from: "hand",
};

it("declares scheduled attacks only after earlier children's choices finish, in operation order", () => {
  const initial = begin([
    play,
    { type: "attack", targets: ["ai1"] },
    { type: "attack", targets: ["ai2"] },
  ]);
  expect(initial.state.pendingChoice?.choiceType).toBe("decision");
  expect(initial.events.some(event => event.type === "ATTACK_DECLARED")).toBe(
    false,
  );
  expect(
    initial.state.executionStack
      ?.filter(frame => frame.type === "attack")
      .map(frame => frame.phase),
  ).toEqual(["declare", "declare"]);
  const events = resumeExecution(initial.state, {
    choice: { selectedCards: ["Estate"] },
  });
  const gainIndex = events.findIndex(event => event.type === "CARD_GAINED");
  const declarationIndex = events.findIndex(
    event => event.type === "ATTACK_DECLARED",
  );
  expect(gainIndex).toBeGreaterThanOrEqual(0);
  expect(declarationIndex).toBeGreaterThan(gainIndex);
  expect(
    events.flatMap<{ declared: string[] } | { resolved: string }>(event =>
      event.type === "ATTACK_DECLARED"
        ? [{ declared: event.targets }]
        : event.type === "ATTACK_RESOLVED"
          ? [{ resolved: event.target }]
          : [],
    ),
  ).toEqual([
    { declared: ["ai1"] },
    { resolved: "ai1" },
    { declared: ["ai2"] },
    { resolved: "ai2" },
  ]);
});

it("persists queued empty attacks, declares them once, and resolves no targets", () => {
  const initial = begin([play, { type: "attack", targets: [] }]);
  expect(initial.events.some(event => event.type === "ATTACK_DECLARED")).toBe(
    false,
  );
  const events = resumeExecution(initial.state, {
    choice: { selectedCards: ["Estate"] },
  });
  expect(
    events
      .filter(event => event.type === "ATTACK_DECLARED")
      .map(event => event.targets),
  ).toEqual([[]]);
  expect(events.some(event => event.type === "ATTACK_RESOLVED")).toBe(false);
  expect(applyEvents(initial.state, events).executionStack).toEqual([]);
});

it("rejects empty attacks already in a target-resolution phase", () => {
  const initial = begin([play, { type: "attack", targets: [] }]);
  const attack = initial.state.executionStack?.find(
    frame => frame.type === "attack",
  );
  if (attack?.type !== "attack") throw new Error("Expected queued attack");
  attack.phase = "react";
  expect(() =>
    resumeExecution(initial.state, { choice: { selectedCards: ["Estate"] } }),
  ).toThrow("Invalid saved attack target");
});
