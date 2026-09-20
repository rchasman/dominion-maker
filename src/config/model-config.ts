/** Shape of one model entry. Lives apart from models.ts so the generated
 *  catalog can be typed without importing back from its own consumer. */
export interface ModelConfig {
  id: string; // Short ID used in code (e.g., "claude-haiku")
  displayName: string; // Human-readable picker label
  fullName: string; // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string; // Provider name for grouping/coloring
  color: string; // UI color
  inputPrice: number; // Catalog base price per 1M input tokens in USD
  outputPrice: number; // Catalog base price per 1M output tokens in USD
  gatewayProviders?: readonly string[]; // Restrict incompatible provider routes
  structuredOutput?: "prompt"; // For providers without native JSON schemas
  evaluation?: true; // Answers a typed Choice via experimental_evaluate, no JSON reply
  maxInstances?: number; // Max instances allowed in consensus (optional, default: unlimited)
}
