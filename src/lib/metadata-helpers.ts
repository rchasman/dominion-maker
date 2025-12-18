import type { CardName, PendingChoice } from "../types/game-state";

/**
 * Type-safe metadata accessors to eliminate unsafe casts.
 */

export function getCardNamesFromMetadata(
  metadata: Extract<PendingChoice, { choiceType: "decision" }>["metadata"],
  key: string,
): CardName[] {
  const value = metadata?.[key];
  return Array.isArray(value) ? (value as CardName[]) : [];
}

export function getStringArrayFromMetadata(
  metadata: Extract<PendingChoice, { choiceType: "decision" }>["metadata"],
  key: string,
): string[] {
  const value = metadata?.[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export function getNumberFromMetadata(
  metadata: Extract<PendingChoice, { choiceType: "decision" }>["metadata"],
  key: string,
  defaultValue: number = 0,
): number {
  const value = metadata?.[key];
  return typeof value === "number" ? value : defaultValue;
}

export function getStringFromMetadata(
  metadata: Extract<PendingChoice, { choiceType: "decision" }>["metadata"],
  key: string,
  defaultValue: string = "",
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : defaultValue;
}
