import type { ModelProvider } from "../config/models";
import { FAST_PRESET } from "./consensus/presets";

export type LlmSeatConfig = {
  kind: "llm";
  models: ModelProvider[];
  consensusCount: number;
  customStrategy: string;
};

export type ControllerConfig =
  | { kind: "human" }
  | { kind: "heuristic" }
  | LlmSeatConfig;

export type ControllerKind = ControllerConfig["kind"];

export type Seats<P extends string = string> = Record<P, ControllerConfig>;

export const HUMAN_SEAT: ControllerConfig = { kind: "human" };
export const HEURISTIC_SEAT: ControllerConfig = { kind: "heuristic" };
export const DEFAULT_LLM_SEAT: LlmSeatConfig = {
  kind: "llm",
  models: [...FAST_PRESET.models],
  consensusCount: FAST_PRESET.consensusCount,
  customStrategy: "",
};

/** A room reports seats as kinds only; the LLM roster stays on the server */
export const seatFromKind = (
  kind: ControllerKind,
  defaultLlm: LlmSeatConfig,
): ControllerConfig => {
  if (kind === "heuristic") return HEURISTIC_SEAT;
  if (kind === "llm") return defaultLlm;
  return HUMAN_SEAT;
};

/** A missing seat counts as human so the driver never acts for an unknown player */
export const isHumanSeat = (config: ControllerConfig | undefined): boolean =>
  config === undefined || config.kind === "human";

export const firstHumanSeat = <P extends string>(
  seats: Seats,
  order: readonly P[],
): P | null => order.find(id => isHumanSeat(seats[id])) ?? null;

export const hasLlmSeat = (seats: Seats): boolean =>
  Object.values(seats).some(config => config.kind === "llm");

export const sameConfig = (
  a: ControllerConfig | undefined,
  b: ControllerConfig | undefined,
): boolean =>
  JSON.stringify(a ?? HUMAN_SEAT) === JSON.stringify(b ?? HUMAN_SEAT);

export const withSeat = <P extends string>(
  seats: Seats<P>,
  player: P,
  config: ControllerConfig,
): Seats<P> => ({ ...seats, [player]: config });
