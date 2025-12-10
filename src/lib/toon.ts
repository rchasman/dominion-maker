import { encode, decode } from "@toon-format/toon";

/**
 * Encode data to TOON format with tab delimiters for optimal token efficiency
 */
export function encodeToon(data: unknown): string {
  return encode(data, { delimiter: "\t" });
}

/**
 * Decode TOON format back to JSON with strict validation
 * Validates counts, indentation, and escaping to detect truncation or malformed TOON
 */
export function decodeToon<T = unknown>(toonString: string): T {
  return decode(toonString, { strict: true }) as T;
}

/**
 * TOON format instruction for LLM system prompts
 * This should be included in all prompts that send or receive TOON-formatted data
 */
export const TOON_FORMAT_INSTRUCTION = `Data is in TOON format (2-space indent, arrays show length and fields).

Example:
\`\`\`toon
users[3]{id,name,role,lastLogin}:
  1	Alice	admin	2025-01-15T10:30:00Z
  2	Bob	user	2025-01-14T15:22:00Z
  3	Charlie	user	2025-01-13T09:45:00Z
\`\`\`

Task: Return only users with role "user" as TOON. Use the same header format. Set [N] to match the row count. Output only the code block.`;
