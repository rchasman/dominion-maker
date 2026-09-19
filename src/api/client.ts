// Simple fetch-based API client (no Elysia dependency needed)
// Vite dev server proxies /api/* to our handler via middleware
// Production uses Vercel serverless functions

import type { Action } from "../types/action";
import type { WeightedVote } from "../core/consensus/types";
import type { PlayerStrategyData } from "../types/player-strategy";

interface GenerateActionRequest {
  game: "dominion";
  provider: string;
  actionId?: string | undefined;
  currentState: unknown;
  playerStrategies?: Record<string, unknown> | undefined;
  customStrategy?: string | undefined;
}

interface GenerateActionResponse {
  move?: Action;
  distribution?: WeightedVote<Action>[];
  error?: number;
  message?: string;
}

interface VerifyActionRequest {
  currentState: unknown;
  action: Action;
  customStrategy?: string;
}

export interface VerifyActionResponse {
  blunder?: number;
  followsOverride?: number;
  error?: string;
  message?: string;
}

interface AnalyzeStrategyRequest {
  currentState: unknown;
  previousAnalysis?: PlayerStrategyData;
}

interface AnalyzeStrategyResponse {
  strategySummary?: PlayerStrategyData;
  error?: number;
  message?: string;
}

/** `baseUrl` is empty in the browser (same origin) and the API origin in the PartyKit worker */
export function createApiClient(baseUrl = "") {
  return {
    api: {
      "analyze-strategy": {
        post: async (
          body: AnalyzeStrategyRequest,
          options?: { fetch?: RequestInit },
        ) => {
          try {
            const response = await fetch(`${baseUrl}/api/analyze-strategy`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              ...options?.fetch,
            });

            const data = (await response.json()) as AnalyzeStrategyResponse;

            if (!response.ok) {
              return {
                data: null,
                error: { value: data.message || "Request failed" },
              };
            }

            return { data, error: null };
          } catch (err) {
            return { data: null, error: { value: String(err) } };
          }
        },
      },
      "verify-action": {
        post: async (
          body: VerifyActionRequest,
          options?: { fetch?: RequestInit },
        ) => {
          try {
            const response = await fetch(`${baseUrl}/api/verify-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              ...options?.fetch,
            });
            const data = (await response.json()) as VerifyActionResponse;
            if (!response.ok) {
              return {
                data: null,
                error: {
                  value: data.message || data.error || "Request failed",
                },
              };
            }
            return { data, error: null };
          } catch (error) {
            return {
              data: null,
              error: {
                value: error instanceof Error ? error.message : "Network error",
              },
            };
          }
        },
      },
      "generate-action": {
        post: async (
          body: GenerateActionRequest,
          options?: { fetch?: RequestInit },
        ) => {
          try {
            const response = await fetch(`${baseUrl}/api/generate-action`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              ...options?.fetch,
            });

            const data = (await response.json()) as GenerateActionResponse;

            if (!response.ok) {
              return {
                data: null,
                error: { value: data.message || "Request failed" },
              };
            }

            return { data, error: null };
          } catch (err) {
            return { data: null, error: { value: String(err) } };
          }
        },
      },
    },
  };
}

export const api = createApiClient();
