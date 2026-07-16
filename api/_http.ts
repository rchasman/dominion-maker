/**
 * Minimal request/response shapes shared by all API handlers.
 * Structurally compatible with Vercel serverless functions and the
 * Bun dev-server bridge in server.ts. Underscore-prefixed files in
 * api/ are not deployed as serverless functions.
 */

export interface VercelRequest {
  method?: string;
  body?: unknown;
  text?: () => Promise<string>;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
  send: (data: string) => VercelResponse;
  setHeader: (key: string, value: string) => VercelResponse;
}
