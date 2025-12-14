// Simple fetch-based API client (no Elysia dependency needed)
// Vite dev server proxies /api/* to our handler via middleware
// Production uses Vercel serverless functions

import type { Action } from "../types/action";

interface GenerateActionRequest {
  provider: string;
  currentState: unknown;
  humanChoice?: { selectedCards: string[] };
  legalActions?: unknown[];
  strategySummary?: string;
  customStrategy?: string;
  format?: "json" | "toon";
}

interface GenerateActionResponse {
  action?: Action;
  format?: "json" | "toon";
  error?: number;
  message?: string;
}

interface AnalyzeStrategyRequest {
  currentState: unknown;
  previousAnalysis?: Array<{
    id: string;
    gameplan: string;
    read: string;
    recommendation: string;
  }>;
}

interface AnalyzeStrategyResponse {
  strategySummary?: Array<{
    id: string;
    gameplan: string;
    read: string;
    recommendation: string;
  }>;
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
