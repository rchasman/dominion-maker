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
