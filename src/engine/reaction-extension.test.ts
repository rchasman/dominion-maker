import { expect, it } from "bun:test";
import { z } from "zod";
import { DominionEngine } from "./engine";
import { runExecution } from "./execute";
import { choose, defineEffect, done, schedule } from "../cards/program";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "../events/apply";
import type { GameState } from "../types/game-state";

it("resumes a nonblocking reaction's choice before resolving the attack", () => {
  // Give an existing reaction identity a hypothetical expansion effect through
  // the registry: the runner needs no special case for this behavior.
  const reaction = defineEffect(
    z.object({ bonus: z.number() }),
    ({ playerId }, input) => {
      if (input.type === "answer")
        return done([{ type: "COINS_MODIFIED", delta: input.memory.bonus }]);
      return choose(
        {
          choiceType: "decision",
          playerId,
          cardBeingPlayed: "Moat",
          prompt: "Accept a coin",
          cardOptions: [],
          min: 0,
          max: 0,
          intent: "select",
        },
        { bonus: 1 },
      );
    },
  );
  const registry = (card: Parameters<typeof getCardEffect>[0]) =>
    card === "Moat" ? reaction : getCardEffect(card);
  const engine = new DominionEngine();
  engine.startGame(["attacker", "victim"], ["Militia", "Moat"]);
  engine.applyExternalEvents([
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "victim",
      cards: ["Moat", "Copper", "Copper", "Estate", "Estate"],
    },
    {
      type: "INITIAL_HAND_DRAWN",
      playerId: "victim",
      cards: ["Moat", "Copper", "Copper", "Estate", "Estate"],
    },
  ]);
  let state = engine.state;
  const opportunity = runExecution(
    state,
    [
      {
        type: "attack",
        card: "Militia",
        playerId: "attacker",
        cause: "attack",
        targets: ["victim"],
        index: 0,
        phase: "react",
        blocked: false,
      },
    ],
    () => 0.5,
    undefined,
    registry,
  );
  state = applyEvents(state, opportunity);
  expect(state.pendingChoice?.choiceType).toBe("reaction");
  const beforeChoice = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { reaction: "Moat" },
    registry,
  );
  state = applyEvents(state, beforeChoice);
  expect(state.pendingChoice?.choiceType).toBe("decision");
  expect(beforeChoice.some(event => event.type === "ATTACK_RESOLVED")).toBe(
    false,
  );
  state = JSON.parse(JSON.stringify(state)) as GameState;
  const afterChoice = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { choice: { selectedCards: [] } },
    registry,
  );
  state = applyEvents(state, afterChoice);
  expect(state.pendingChoice).toMatchObject({
    choiceType: "reaction",
    playerId: "victim",
  });
  expect(afterChoice.some(event => event.type === "ATTACK_RESOLVED")).toBe(
    false,
  );
  const declined = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { reaction: null },
    registry,
  );
  state = applyEvents(state, declined);
  expect(
    declined.find(event => event.type === "ATTACK_RESOLVED"),
  ).toMatchObject({ blocked: false, target: "victim" });
  expect(state.pendingChoice).toMatchObject({
    cardBeingPlayed: "Militia",
    intent: "discard",
    playerId: "victim",
  });
  const finished = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { choice: { selectedCards: ["Estate", "Estate"] } },
    registry,
  );
  state = applyEvents(state, finished);
  expect(state.pendingChoice).toBeNull();
  expect(state.executionStack).toEqual([]);
  expect(state.players.victim!.hand).toEqual(["Moat", "Copper", "Copper"]);
});

it("finishes a reaction's scheduled child before resuming its saved continuation", () => {
  const reaction = defineEffect(
    z.object({ bonus: z.number() }),
    (context, input) => {
      expect(context.playerId).toBe("victim");
      expect(context.trigger).toEqual({
        type: "reaction",
        attacker: "attacker",
        attackCard: "Militia",
      });
      if (input.type === "continue") {
        // The parent observes the completed child, including the choice made
        // after reloading, before it supplies the block result.
        expect(context.state.players.victim!.discard).toContain("Silver");
        return done(
          [{ type: "COINS_MODIFIED", delta: input.memory.bonus }],
          true,
        );
      }
      if (input.type !== "start") throw new Error("Unexpected parent choice");
      return schedule(
        [
          {
            type: "play",
            playerId: context.playerId,
            card: "Workshop",
            from: "hand",
          },
        ],
        [],
        { bonus: 2 },
      );
    },
  );
  const registry = (card: Parameters<typeof getCardEffect>[0]) =>
    card === "Moat" ? reaction : getCardEffect(card);
  const engine = new DominionEngine();
  engine.startGame(["attacker", "victim"], ["Militia", "Moat", "Workshop"]);
  const hand = ["Moat", "Workshop", "Copper", "Estate", "Estate"] as const;
  engine.applyExternalEvents([
    { type: "INITIAL_DECK_DEALT", playerId: "victim", cards: [...hand] },
    { type: "INITIAL_HAND_DRAWN", playerId: "victim", cards: [...hand] },
  ]);
  let state = engine.state;
  state = applyEvents(
    state,
    runExecution(
      state,
      [
        {
          type: "attack",
          card: "Militia",
          playerId: "attacker",
          cause: "attack",
          targets: ["victim"],
          index: 0,
          phase: "react",
          blocked: false,
        },
      ],
      () => 0.5,
      undefined,
      registry,
    ),
  );
  const child = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { reaction: "Moat" },
    registry,
  );
  state = applyEvents(state, child);
  expect(state.pendingChoice).toMatchObject({
    cardBeingPlayed: "Workshop",
    intent: "gain",
    playerId: "victim",
  });
  expect(state.executionStack!.map(frame => frame.type)).toEqual([
    "attack",
    "continue",
    "choice",
  ]);
  expect(
    child.some(
      event =>
        event.type === "COINS_MODIFIED" || event.type === "ATTACK_RESOLVED",
    ),
  ).toBe(false);
  state = JSON.parse(JSON.stringify(state)) as GameState;
  const finished = runExecution(
    state,
    state.executionStack!,
    () => 0.5,
    { choice: { selectedCards: ["Silver"] } },
    registry,
  );
  state = applyEvents(state, finished);
  const gainIndex = finished.findIndex(event => event.type === "CARD_GAINED");
  const bonusIndex = finished.findIndex(
    event => event.type === "COINS_MODIFIED",
  );
  const attackIndex = finished.findIndex(
    event => event.type === "ATTACK_RESOLVED",
  );
  expect(gainIndex).toBeGreaterThanOrEqual(0);
  expect(bonusIndex).toBeGreaterThan(gainIndex);
  expect(attackIndex).toBeGreaterThan(bonusIndex);
  expect(finished[attackIndex]).toMatchObject({
    blocked: true,
    target: "victim",
  });
  expect(state.players.victim!.discard).toEqual(["Silver"]);
  expect(state.players.victim!.inPlay).toEqual(["Workshop"]);
  expect(state.players.victim!.hand).toEqual([
    "Moat",
    "Copper",
    "Estate",
    "Estate",
  ]);
  expect(state.coins).toBe(2);
  expect(state.pendingChoice).toBeNull();
  expect(state.executionStack).toEqual([]);
});
