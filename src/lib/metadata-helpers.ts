import type { CardName, DecisionRequest } from "../types/game-state";

/**
 * Type-safe metadata accessors to eliminate unsafe casts.
 */

export function getCardNamesFromMetadata(
  metadata: DecisionRequest["metadata"],
  key: string,
): CardName[] {
  const value = metadata?.[key];
  return Array.isArray(value) ? (value as CardName[]) : [];
}

export function getStringArrayFromMetadata(
  metadata: DecisionRequest["metadata"],
  key: string,
): string[] {
  const value = metadata?.[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export function getNumberFromMetadata(
  metadata: DecisionRequest["metadata"],
  key: string,
  defaultValue: number = 0,
): number {
  const value = metadata?.[key];
  return typeof value === "number" ? value : defaultValue;
}

export function getStringFromMetadata(
  metadata: DecisionRequest["metadata"],
  key: string,
  defaultValue: string = "",
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : defaultValue;
}
