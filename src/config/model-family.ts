/** Version tokens: 4.1, v4, 4o, a date stamp like 0902, and marketing suffixes. */
const VERSION_TOKEN = /^v?\d+(\.\d+)*$|^\d+o$|^\d{4,6}$|^preview$|^latest$/;

/**
 * The model's class, with its version stripped: everything that makes one entry
 * a newer release of another rather than a different product.
 *
 *   anthropic/claude-opus-4.8  -> anthropic/claude-opus
 *   google/gemini-3.5-flash    -> google/gemini-flash
 *   openai/gpt-5.4-mini-fast   -> openai/gpt-mini-fast
 *
 * Size and tier markers stay, because they are the product, not the version:
 * ministral-3b and ministral-8b are different classes, gpt-5-mini and
 * gpt-5.4-mini are the same one.
 */
export const modelFamily = (fullName: string): string => {
  const [provider = "", name = ""] = fullName.split("/");
  const tokens = name
    .split(/[-_]/)
    .filter(token => !VERSION_TOKEN.test(token))
    .map(token => token.replace(/\d+(\.\d+)*$/, "") || token);
  return `${provider}/${tokens.join("-")}`;
};
