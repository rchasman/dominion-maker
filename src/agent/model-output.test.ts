import { describe, expect, it } from "bun:test";
import { generateObject, NoObjectGeneratedError, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { choiceSchema } from "./choice-parsing";
import { promptJsonMiddleware } from "./model-output";

describe("prompted JSON model compatibility", () => {
  const createModel = (text: string) => {
    const base = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      },
    });
    return {
      base,
      model: wrapLanguageModel({
        model: base,
        middleware: promptJsonMiddleware,
      }),
    };
  };

  it("avoids native schemas while preserving ZDR routing and validation", async () => {
    const { base, model } = createModel(
      '{"reasoning":"Buy Silver","choice":1}',
    );
    const result = await generateObject({
      model,
      prompt: "Choose an action. Return JSON with reasoning and choice.",
      schema: choiceSchema(3),
      providerOptions: { gateway: { zeroDataRetention: true, sort: "ttft" } },
    });
    expect(result.object.choice).toBe(1);
    expect(base.doGenerateCalls[0]?.responseFormat).toEqual({ type: "text" });
    expect(base.doGenerateCalls[0]?.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, sort: "ttft" },
    });
  });

  it("rejects malformed JSON and choices outside the legal range", async () => {
    for (const reply of ["Buy Silver", '{"reasoning":"Invalid","choice":4}']) {
      const { model } = createModel(reply);
      const error: unknown = await generateObject({
        model,
        prompt: "Choose an action.",
        schema: choiceSchema(3),
      }).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(NoObjectGeneratedError);
    }
  });
});
