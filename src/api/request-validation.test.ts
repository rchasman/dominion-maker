import { describe, expect, it } from "bun:test";
import { handleApiRequest } from "../../api/_router";
import { actionRequestSchema, analysisRequestSchema } from "../../api/_request";
import { createGame } from "../engine";
import { generateActionViaBackend } from "../agent/game-agent-helpers";
import { api } from "./client";

describe("API request boundaries", () => {
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
        provider: "constructor",
        currentState: state,
      }).success,
    ).toBe(false);
  });
  it("forwards the consensus action ID to the backend", async () => {
    const original = api.api["generate-action"].post;
    const calls: unknown[] = [];
    api.api["generate-action"].post = body => {
      calls.push(body);
      return Promise.resolve({
        data: { action: { type: "end_phase" } },
        error: null,
      });
    };
    try {
      await generateActionViaBackend({
        provider: "gpt-5.4-mini",
        currentState: createGame(["human", "ai"]).state,
        actionId: "game-turn-round",
      });
      expect(calls[0]).toHaveProperty("actionId", "game-turn-round");
    } finally {
      api.api["generate-action"].post = original;
    }
  });
});
