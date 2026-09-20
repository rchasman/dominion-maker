import { describe, expect, it } from "bun:test";
import { handleApiRequest } from "../../api/_router";
import { actionRequestSchema, analysisRequestSchema } from "../../api/_request";
import { createGame } from "../engine";
import { httpDecideMove } from "../agent/http-decide-move";
import { dominionModule } from "../dominion/module";
import { MODELS } from "../config/models";
import type { Action } from "../types/action";
import type { WeightedVote } from "../core/consensus/types";

describe("API request boundaries", () => {
  it("accepts every catalog model and rejects one the gateway refuses", () => {
    const currentState = createGame(["human", "ai"], undefined, 42).state;
    for (const model of MODELS) {
      expect(
        actionRequestSchema.safeParse({
          game: "dominion",
          provider: model.id,
          currentState,
        }).success,
      ).toBe(true);
    }
    expect(
      actionRequestSchema.safeParse({
        game: "dominion",
        // zdr "none": the ZDR-only account cannot call it, so it is not generated
        provider: "claude-fable-5",
        currentState,
      }).success,
    ).toBe(false);
  });
  it("rejects malformed JSON and wrong shapes on every endpoint", async () => {
    for (const endpoint of [
      "generate-action",
      "analyze-strategy",
      "patrick-chat",
      "strategy-react",
    ]) {
      for (const body of [
        "{",
        "null",
        "{}",
        '{"message":42,"strategy":false,"currentState":{}}',
      ]) {
        const response = await handleApiRequest(
          new Request(`http://localhost/api/${endpoint}`, {
            method: "POST",
            body,
          }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "Invalid request",
          message: "Invalid request",
        });
      }
      expect(
        (
          await handleApiRequest(
            new Request(`http://localhost/api/${endpoint}`),
          )
        ).status,
      ).toBe(405);
      const preflight = await handleApiRequest(
        new Request(`http://localhost/api/${endpoint}`, { method: "OPTIONS" }),
      );
      expect(preflight.status).toBe(204);
      expect(await preflight.text()).toBe("");
    }
  });
  it("accepts real engine snapshots and rejects unknown cards and player references", () => {
    const state = createGame(["human", "ai"], undefined, 42).state;
    expect(
      actionRequestSchema.safeParse({
        game: "dominion",
        provider: "gpt-5.4-mini",
        currentState: state,
        actionId: "round-1",
      }).success,
    ).toBe(true);
    expect(
      analysisRequestSchema.safeParse({ currentState: state }).success,
    ).toBe(true);
    expect(
      analysisRequestSchema.safeParse({
        currentState: { ...state, activePlayerId: "missing" },
      }).success,
    ).toBe(false);
    expect(
      analysisRequestSchema.safeParse({
        currentState: { ...state, supply: { Bogus: 10 } },
      }).success,
    ).toBe(false);
    expect(
      actionRequestSchema.safeParse({
        game: "dominion",
        provider: "constructor",
        currentState: state,
      }).success,
    ).toBe(false);
    expect(
      actionRequestSchema.safeParse({
        provider: "gpt-5.4-mini",
        currentState: state,
      }).success,
    ).toBe(false);
  });
  it("forwards the game and strategies to the backend", async () => {
    const originalFetch = global.fetch;
    const bodies: unknown[] = [];
    const stub: typeof fetch = Object.assign(
      (_input: URL | RequestInfo, init?: RequestInit) => {
        const raw = init?.body;
        bodies.push(typeof raw === "string" ? JSON.parse(raw) : raw);
        return Promise.resolve(Response.json({ move: { type: "end_phase" } }));
      },
      { preconnect: originalFetch.preconnect },
    );
    global.fetch = stub;
    try {
      const result = await httpDecideMove(dominionModule)({
        provider: "gpt-5.4-mini",
        state: createGame(["human", "ai"]).state,
        actionId: "game-turn-round",
        playerStrategies: { human: { gameplan: "BM" } },
        customStrategy: "Buy Gold",
        signal: new AbortController().signal,
      });
      expect(result.move).toEqual({ type: "end_phase" });
      expect(bodies[0]).toMatchObject({
        game: "dominion",
        playerStrategies: { human: { gameplan: "BM" } },
        customStrategy: "Buy Gold",
      });
      expect(bodies[0]).not.toHaveProperty("actionId");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("parses the winning move and every distribution vote with the module's schema", async () => {
    const originalFetch = global.fetch;
    const reply: { move: Action; distribution: WeightedVote<Action>[] } = {
      move: { type: "buy_card", card: "Silver", reasoning: "money first" },
      distribution: [
        { move: { type: "buy_card", card: "Silver" }, weight: 0.7 },
        { move: { type: "end_phase" }, weight: 0.3 },
      ],
    };
    global.fetch = Object.assign(() => Promise.resolve(Response.json(reply)), {
      preconnect: originalFetch.preconnect,
    });
    try {
      const result = await httpDecideMove(dominionModule)({
        provider: "gpt-5.4-mini",
        state: createGame(["human", "ai"]).state,
        actionId: "round",
        playerStrategies: {},
        customStrategy: "",
        signal: new AbortController().signal,
      });
      expect(result.move).toEqual(reply.move);
      expect(result.distribution).toEqual(reply.distribution);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws when the reply carries a move shape the game does not know", async () => {
    const replies = [
      { move: { type: "teleport" } },
      {
        move: { type: "end_phase" },
        distribution: [{ move: { type: "teleport" }, weight: 1 }],
      },
    ];
    const originalFetch = global.fetch;
    try {
      const thrown = await Promise.all(
        replies.map(async reply => {
          global.fetch = Object.assign(
            () => Promise.resolve(Response.json(reply)),
            { preconnect: originalFetch.preconnect },
          );
          return httpDecideMove(dominionModule)({
            provider: "gpt-5.4-mini",
            state: createGame(["human", "ai"]).state,
            actionId: "round",
            playerStrategies: {},
            customStrategy: "",
            signal: new AbortController().signal,
          }).then(
            () => null,
            (error: unknown) => error,
          );
        }),
      );
      expect(thrown.filter(error => error !== null)).toHaveLength(
        replies.length,
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
