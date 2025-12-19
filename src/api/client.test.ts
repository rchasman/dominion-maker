import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { api } from "./client";
import type { Action } from "../types/action";

describe("api.api.analyze-strategy", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("post method", () => {
    it("successfully calls analyze-strategy endpoint with valid response", async () => {
      const mockResponse = {
        strategySummary: [
          {
            id: "test-1",
            gameplan: "Buy gold",
            read: "Opponent weak",
            recommendation: "Attack now",
          },
        ],
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: { players: [] },
      });

      expect(result.data).toEqual(mockResponse);
      expect(result.error).toBe(null);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analyze-strategy",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("includes request body in fetch call", async () => {
      const requestBody = {
        currentState: { score: 100 },
        previousAnalysis: [
          {
            id: "prev-1",
            gameplan: "Save money",
            read: "Strong position",
            recommendation: "Wait",
          },
        ],
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      await api.api["analyze-strategy"].post(requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analyze-strategy",
        expect.objectContaining({
          body: JSON.stringify(requestBody),
        }),
      );
    });

    it("handles error response with error message", async () => {
      const errorMessage = "Analysis failed";
      global.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            error: 500,
            message: errorMessage,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: errorMessage });
    });

    it("handles error response without message", async () => {
      global.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            error: 400,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: "Request failed" });
    });

    it("handles network error during fetch", async () => {
      const errorMessage = "Network connection failed";
      global.fetch = mock(async () => {
        throw new Error(errorMessage);
      });

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: `Error: ${errorMessage}` });
    });

    it("handles timeout error", async () => {
      global.fetch = mock(async () => {
        throw new Error("Request timeout");
      });

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: "Error: Request timeout" });
    });

    it("merges custom fetch options", async () => {
      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      const customHeaders = { Authorization: "Bearer token" };
      await api.api["analyze-strategy"].post(
        { currentState: {} },
        { fetch: { headers: customHeaders } },
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining(customHeaders),
      );
    });

    it("returns data as null on non-ok response with JSON parse error", async () => {
      global.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            error: 502,
            message: "Bad Gateway",
          }),
          {
            status: 502,
          },
        ),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toBeDefined();
    });

    it("handles complex currentState object", async () => {
      const complexState = {
        players: [
          {
            id: "p1",
            hand: ["gold", "silver"],
            deck: ["copper"],
            discard: [],
            played: [],
            coins: 5,
            buys: 1,
            actions: 1,
          },
        ],
        supply: {
          gold: 30,
          silver: 40,
          copper: 46,
        },
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({ strategySummary: [] }), {
          status: 200,
        }),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: complexState,
      });

      expect(result.data).toEqual({ strategySummary: [] });
      expect(result.error).toBe(null);
    });

    it("handles multiple previous analysis entries", async () => {
      const requestBody = {
        currentState: {},
        previousAnalysis: [
          {
            id: "1",
            gameplan: "Plan A",
            read: "Strong",
            recommendation: "Act",
          },
          {
            id: "2",
            gameplan: "Plan B",
            read: "Weak",
            recommendation: "Wait",
          },
          {
            id: "3",
            gameplan: "Plan C",
            read: "Neutral",
            recommendation: "Adapt",
          },
        ],
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      await api.api["analyze-strategy"].post(requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analyze-strategy",
        expect.objectContaining({
          body: JSON.stringify(requestBody),
        }),
      );
    });
  });
});

describe("api.api.generate-action", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("post method", () => {
    it("successfully calls generate-action endpoint with valid response", async () => {
      const mockAction: Action = {
        type: "play-card",
        card: "gold",
        player: "p1",
      };

      const mockResponse = {
        action: mockAction,
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: { players: [] },
      });

      expect(result.data).toEqual(mockResponse);
      expect(result.error).toBe(null);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/generate-action",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("includes all request parameters in fetch body", async () => {
      const requestBody = {
        provider: "anthropic",
        currentState: { score: 50 },
        humanChoice: { selectedCards: ["gold", "silver"] },
        legalActions: [{ type: "play-card", card: "gold" }],
        strategySummary: "Buy expensive cards",
        customStrategy: "Aggressive strategy",
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      await api.api["generate-action"].post(requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/generate-action",
        expect.objectContaining({
          body: JSON.stringify(requestBody),
        }),
      );
    });

    it("handles error response with error message", async () => {
      const errorMessage = "Failed to generate action";
      global.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            error: 500,
            message: errorMessage,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: errorMessage });
    });

    it("handles error response without message", async () => {
      global.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            error: 400,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: "Request failed" });
    });

    it("handles network error during fetch", async () => {
      const errorMessage = "Network unavailable";
      global.fetch = mock(async () => {
        throw new Error(errorMessage);
      });

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: `Error: ${errorMessage}` });
    });

    it("handles timeout error", async () => {
      global.fetch = mock(async () => {
        throw new Error("API timeout");
      });

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: "Error: API timeout" });
    });

    it("merges custom fetch options", async () => {
      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      const customHeaders = { Authorization: "Bearer token123" };
      await api.api["generate-action"].post(
        { provider: "openai", currentState: {} },
        { fetch: { headers: customHeaders } },
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining(customHeaders),
      );
    });

    it("handles humanChoice with multiple selected cards", async () => {
      const requestBody = {
        provider: "openai",
        currentState: {},
        humanChoice: { selectedCards: ["gold", "silver", "copper", "estate"] },
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      await api.api["generate-action"].post(requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/generate-action",
        expect.objectContaining({
          body: JSON.stringify(requestBody),
        }),
      );
    });

    it("handles multiple legal actions", async () => {
      const requestBody = {
        provider: "openai",
        currentState: {},
        legalActions: [
          { type: "play-card", card: "gold" },
          { type: "play-card", card: "silver" },
          { type: "buy-card", card: "province" },
          { type: "end-turn" },
        ],
      };

      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      await api.api["generate-action"].post(requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/generate-action",
        expect.objectContaining({
          body: JSON.stringify(requestBody),
        }),
      );
    });

    it("handles response without action field", async () => {
      global.fetch = mock(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
        }),
      );

      const result = await api.api["generate-action"].post({
        provider: "openai",
        currentState: {},
      });

      expect(result.data).toEqual({});
      expect(result.error).toBe(null);
    });

    it("handles different provider types", async () => {
      const providers = ["openai", "anthropic", "custom"];

      for (const provider of providers) {
        global.fetch = mock(async () =>
          new Response(JSON.stringify({}), {
            status: 200,
          }),
        );

        await api.api["generate-action"].post({
          provider,
          currentState: {},
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "/api/generate-action",
          expect.objectContaining({
            method: "POST",
          }),
        );
      }
    });
  });
});

describe("api structure", () => {
  it("has nested api object structure", () => {
    expect(api).toBeDefined();
    expect(api.api).toBeDefined();
  });

  it("has analyze-strategy endpoint", () => {
    expect(api.api["analyze-strategy"]).toBeDefined();
    expect(api.api["analyze-strategy"].post).toBeDefined();
  });

  it("has generate-action endpoint", () => {
    expect(api.api["generate-action"]).toBeDefined();
    expect(api.api["generate-action"].post).toBeDefined();
  });

  it("post methods are async functions", async () => {
    expect(typeof api.api["analyze-strategy"].post).toBe("function");
    expect(typeof api.api["generate-action"].post).toBe("function");

    const analyzePromise = api.api["analyze-strategy"].post({
      currentState: {},
    });
    const generatePromise = api.api["generate-action"].post({
      provider: "openai",
      currentState: {},
    });

    expect(analyzePromise instanceof Promise).toBe(true);
    expect(generatePromise instanceof Promise).toBe(true);
  });
});
