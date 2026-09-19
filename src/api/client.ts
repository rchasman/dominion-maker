// Simple fetch-based API client (no Elysia dependency needed)
// Vite dev server proxies /api/* to our handler via middleware
// Production uses Vercel serverless functions

import type { Action, WeightedVote } from "../types/action";
import type { PlayerStrategyData } from "../types/player-strategy";

interface GenerateActionRequest {
  provider: string;
  actionId?: string;
  currentState: unknown;
  humanChoice?: { selectedCards: string[] };
  strategySummary?: string;
  customStrategy?: string;
}

interface GenerateActionResponse {
  action?: Action;
  distribution?: WeightedVote[];
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

export const api = {
  api: {
    "analyze-strategy": {
      post: async (
        body: AnalyzeStrategyRequest,
        options?: { fetch?: RequestInit },
      ) => {
        try {
          const response = await fetch("/api/analyze-strategy", {
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
          const response = await fetch("/api/verify-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            ...options?.fetch,
          });
          const data = (await response.json()) as VerifyActionResponse;
          if (!response.ok) {
            return {
              data: null,
              error: { value: data.message || data.error || "Request failed" },
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
          const response = await fetch("/api/generate-action", {
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
