import { MODELS } from "../../config/models";
import type { ModelConfig, ModelProvider } from "../../config/models";

/** Tokens one model billed for one decision, summed over every attempt it made */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

const TOKENS_PER_PRICED_UNIT = 1_000_000;

export const addUsage = (
  a: TokenUsage | undefined,
  b: TokenUsage | undefined,
): TokenUsage => ({
  inputTokens: (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0),
  outputTokens: (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0),
});

/**
 * What those tokens cost at the catalog's rates, in USD.
 *
 * An estimate, and not a bill: the catalog carries the gateway's base rate, and
 * a routed provider or a service tier can charge differently for the same call.
 */
export const costOf = (
  provider: ModelProvider,
  usage: TokenUsage | undefined,
): number => {
  if (!usage) return 0;
  const model: ModelConfig | undefined = MODELS.find(m => m.id === provider);
  if (!model) return 0;
  return (
    (usage.inputTokens * model.inputPrice +
      usage.outputTokens * model.outputPrice) /
    TOKENS_PER_PRICED_UNIT
  );
};

const CENTS_THRESHOLD = 0.01;
const SUB_CENT_PLACES = 4;
const CENT_PLACES = 2;

/** Sub-cent costs need the extra places or every decision reads as $0.00 */
export const formatCost = (usd: number): string =>
  usd > 0 && usd < CENTS_THRESHOLD
    ? `$${usd.toFixed(SUB_CENT_PLACES)}`
    : `$${usd.toFixed(CENT_PLACES)}`;
