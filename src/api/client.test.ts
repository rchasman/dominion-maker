import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { api, createApiClient } from "./client";
import type { Action } from "../types/action";

// bun's mock() lacks fetch's static properties (preconnect), so cast for assignment
const mockFetch = (impl: () => Promise<Response>) =>
  mock(impl) as unknown as typeof fetch;

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
        strategySummary: {
          "test-1": {
            gameplan: "Buy gold",
            read: "Opponent weak",
            recommendation: "Attack now",
          },
        },
      };

      global.fetch = mockFetch(
        async () =>
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
        previousAnalysis: {
          "prev-1": {
            gameplan: "Save money",
            read: "Strong position",
            recommendation: "Wait",
          },
        },
      };

      global.fetch = mockFetch(
        async () =>
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
      global.fetch = mockFetch(
        async () =>
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
      global.fetch = mockFetch(
        async () =>
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
      global.fetch = mockFetch(async () => {
        throw new Error(errorMessage);
      });

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: `Error: ${errorMessage}` });
    });

    it("handles timeout error", async () => {
      global.fetch = mockFetch(async () => {
        throw new Error("Request timeout");
      });

      const result = await api.api["analyze-strategy"].post({
        currentState: {},
      });

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ value: "Error: Request timeout" });
    });

    it("merges custom fetch options", async () => {
      global.fetch = mockFetch(
        async () =>
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
      global.fetch = mockFetch(
        async () =>
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

      global.fetch = mockFetch(
        async () =>
          new Response(JSON.stringify({ strategySummary: {} }), {
            status: 200,
          }),
      );

      const result = await api.api["analyze-strategy"].post({
        currentState: complexState,
      });

      expect(result.data).toEqual({ strategySummary: {} });
      expect(result.error).toBe(null);
    });

    it("handles multiple previous analysis entries", async () => {
      const requestBody = {
        currentState: {},
        previousAnalysis: {
          "1": {
            gameplan: "Plan A",
            read: "Strong",
            recommendation: "Act",
          },
          "2": {
            gameplan: "Plan B",
            read: "Weak",
            recommendation: "Wait",
          },
          "3": {
            gameplan: "Plan C",
            read: "Neutral",
            recommendation: "Adapt",
          },
        },
      };

      global.fetch = mockFetch(
        async () =>
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

  const request = {
    game: "dominion" as const,
    provider: "openai",
    currentState: { players: [] },
  };

  it("posts to the endpoint and returns the move payload", async () => {
    const move: Action = { type: "play_action", card: "Village" };
    global.fetch = mockFetch(
      async () =>
        new Response(JSON.stringify({ move }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const result = await api.api["generate-action"].post(request);

    expect(result.data).toEqual({ move });
    expect(result.error).toBe(null);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/generate-action",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("includes every request parameter in the fetch body", async () => {
    const body = {
      ...request,
      actionId: "t1-buy-1",
      playerStrategies: { human: { gameplan: "Big Money" } },
      customStrategy: "Buy Gold at 6",
    };
    global.fetch = mockFetch(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );

    await api.api["generate-action"].post(body);

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(callArgs[1].body)).toEqual(body);
  });

  it("returns the server message on an error response", async () => {
    global.fetch = mockFetch(
      async () =>
        new Response(JSON.stringify({ error: 500, message: "Failed" }), {
          status: 500,
        }),
    );
    const result = await api.api["generate-action"].post(request);
    expect(result.data).toBe(null);
    expect(result.error).toEqual({ value: "Failed" });
  });

  it("falls back to a generic message when the error has none", async () => {
    global.fetch = mockFetch(
      async () => new Response(JSON.stringify({ error: 500 }), { status: 500 }),
    );
    const result = await api.api["generate-action"].post(request);
    expect(result.error).toEqual({ value: "Request failed" });
  });

  it("reports a network failure as the error value", async () => {
    global.fetch = mockFetch(async () => {
      throw new Error("Network error");
    });
    const result = await api.api["generate-action"].post(request);
    expect(result.data).toBe(null);
    expect(result.error?.value).toContain("Network error");
  });

  it("merges custom fetch options", async () => {
    global.fetch = mockFetch(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );
    const customHeaders = { Authorization: "Bearer token123" };
    await api.api["generate-action"].post(request, {
      fetch: { headers: customHeaders },
    });
    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[1].headers).toEqual(expect.objectContaining(customHeaders));
  });

  it("prefixes the base URL when one is given", async () => {
    global.fetch = mockFetch(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );
    await createApiClient("https://example.test").api["generate-action"].post(
      request,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/api/generate-action",
      expect.anything(),
    );
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
      game: "dominion",
      provider: "openai",
      currentState: {},
    });

    expect(analyzePromise instanceof Promise).toBe(true);
    expect(generatePromise instanceof Promise).toBe(true);
  });
});
