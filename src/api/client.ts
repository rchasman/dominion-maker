// Simple fetch-based API client (no Elysia dependency needed)
// Vite dev server proxies /api/* to our handler via middleware
// Production uses Vercel serverless functions

interface GenerateActionRequest {
  provider: string;
  currentState: any;
  humanChoice?: { selectedCards: string[] };
  legalActions?: any[];
}

interface GenerateActionResponse {
  action?: any;
  error?: number;
  message?: string;
}

export const api = {
  api: {
    "generate-action": {
      post: async (body: GenerateActionRequest, options?: { fetch?: RequestInit }) => {
        try {
          const response = await fetch("/api/generate-action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            ...options?.fetch,
          });

          const data: GenerateActionResponse = await response.json();

          if (!response.ok) {
            return { data: null, error: { value: data.message || "Request failed" } };
          }

          return { data, error: null };
        } catch (err) {
          return { data: null, error: { value: String(err) } };
        }
      },
    },
  },
};
