/**
 * Typed environment variable access
 * Satisfies noPropertyAccessFromIndexSignature requirement
 */

export const env = {
  NODE_ENV: process.env["NODE_ENV"] as "development" | "production" | "test",
  AI_GATEWAY_API_KEY: process.env["AI_GATEWAY_API_KEY"],
} as const;
