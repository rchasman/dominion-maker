import type { LanguageModelMiddleware } from "ai";

// These providers can return prompted JSON but reject native JSON schemas.
// generateObject still parses and validates the reply against choiceSchema.
export const promptJsonMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  transformParams: ({ params }) =>
    Promise.resolve({
      ...params,
      responseFormat: { type: "text" },
    }),
};
