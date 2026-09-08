import { expect, test } from "bun:test";
import type { EffectContext } from "../program";
import { projectEffectEvents } from "../effect-types";
import { poacher } from "./poacher";
import { harbinger } from "./harbinger";
import { mine } from "./mine";
import { artisan } from "./artisan";
import { cellar } from "./cellar";

function context(card: EffectContext["card"]): EffectContext {
  return {
    card,
    playerId: "human",
    trigger: { type: "play" },
    random: () => 0.5,
    state: {
      playerOrder: ["human"],
      activePlayerId: "human",
      phase: "action",
      turn: 1,
      actions: 1,
      buys: 1,
      coins: 0,
      players: {
        human: {
          hand: [],
          deck: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
      },
      supply: {} as EffectContext["state"]["supply"],
      trash: [],
      turnHistory: [],
      kingdomCards: [],
      gameOver: false,
      winnerId: null,
      activeEffects: [],
    },
  };
}

test("Poacher can discard the card just drawn into an empty hand", () => {
  const ctx = context("Poacher");
  ctx.state.players.human!.deck = ["Estate"];
  ctx.state.supply.Copper = 0;
  const result = poacher.run(ctx, { type: "start" });
  expect(result.type).toBe("choice");
  if (result.type !== "choice") throw new Error("Expected discard choice");
  expect(result.request.cardOptions).toEqual(["Estate"]);
  expect(result.request.min).toBe(1);
});

test("Harbinger does not offer cards shuffled out of discard by its draw", () => {
  const ctx = context("Harbinger");
  ctx.state.players.human!.discard = ["Estate", "Copper"];
  const result = harbinger.run(ctx, { type: "start" });
  expect(result.type).toBe("done");
  const state = projectEffectEvents(ctx.state, result.events);
  expect(state.players.human!.discard).toEqual([]);
  expect(state.players.human!.hand).toHaveLength(1);
});

test("Mine allows declining to trash a Treasure", () => {
  const ctx = context("Mine");
  ctx.state.players.human!.hand = ["Copper"];
  const result = mine.run(ctx, { type: "start" });
  if (result.type !== "choice")
    throw new Error("Expected optional trash choice");
  expect(result.request.min).toBe(0);
  expect(
    mine.run(ctx, {
      type: "answer",
      memory: result.memory,
      answer: { selectedCards: [] },
    }),
  ).toEqual({ type: "done", events: [] });
});

test("Artisan still puts a card on deck when no supply card can be gained", () => {
  const ctx = context("Artisan");
  ctx.state.players.human!.hand = ["Gold"];
  const result = artisan.run(ctx, { type: "start" });
  if (result.type !== "choice") throw new Error("Expected topdeck choice");
  expect(result.request.intent).toBe("topdeck");
  const answer = artisan.run(ctx, {
    type: "answer",
    memory: result.memory,
    answer: { selectedCards: ["Gold"] },
  });
  expect(
    projectEffectEvents(ctx.state, answer.events).players.human!.deck,
  ).toEqual(["Gold"]);
});

test("Cellar includes newly discarded cards when shuffling to draw", () => {
  const ctx = context("Cellar");
  ctx.state.players.human!.hand = ["Copper", "Estate"];
  const result = cellar.run(ctx, {
    type: "answer",
    memory: null,
    answer: { selectedCards: ["Copper", "Estate"] },
  });
  const state = projectEffectEvents(ctx.state, result.events);
  expect([...state.players.human!.hand].sort()).toEqual(["Copper", "Estate"]);
  expect(state.players.human!.discard).toEqual([]);
  expect(state.players.human!.deck).toEqual([]);
});
