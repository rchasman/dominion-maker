/**
 * A consensus log entry as one viewer may see it.
 *
 * The seat that voted sees its own entry whole. Everyone else, spectators
 * included, gets an allowlist: a move the models weighed but did not play
 * stays hidden forever, so naming one would leak the bot's hand permanently.
 * Built explicitly, so a future payload field must be named to become public.
 */
import type { LLMLogEntry } from "../core/consensus/types";

/** A log entry payload, opaque to the core and shaped by this game */
type Payload = Record<string, unknown>;

const isRecord = (value: unknown): value is Payload =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pick = (source: Payload, keys: readonly string[]): Payload =>
  Object.fromEntries(
    keys.filter(key => key in source).map(key => [key, source[key]]),
  );

const countOf = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;

/** The acting player as the table already sees them: cards in play, not in hand */
const publicPlayer = (player: unknown): Payload => {
  if (!isRecord(player)) return {};
  return {
    ...pick(player, ["inPlay", "discard"]),
    handCount: countOf(player["hand"]),
    deckCount: countOf(player["deck"]),
  };
};

const PUBLIC_PAYLOAD_KEYS = [
  "turn",
  "phase",
  "actions",
  "buys",
  "coins",
  "inPlay",
  "handCounts",
  "legalActionsCount",
  "decisionType",
] as const;

const publicPayload = (payload: unknown): Payload => {
  if (!isRecord(payload)) return {};
  return {
    ...pick(payload, PUBLIC_PAYLOAD_KEYS),
    activePlayerId: publicPlayer(payload["activePlayerId"]),
  };
};

const redact = (type: string, data: Payload): Payload => {
  if (type === "ai-turn-start")
    return pick(data, ["playerId", "turn", "phase", "providers"]);
  if (type === "ai-decision-resolving")
    return pick(data, ["playerId", "turn", "decisionType"]);
  if (type === "consensus-skipped")
    return pick(data, ["playerId", "turn", "action"]);
  if (type === "consensus-start")
    return {
      ...pick(data, [
        "playerId",
        "providers",
        "totalModels",
        "phase",
        "legalActionsCount",
        "turn",
      ]),
      gameState: publicPayload(data["gameState"]),
    };
  if (type === "consensus-model-pending" || type === "consensus-model-aborted")
    return pick(data, [
      "playerId",
      "provider",
      "index",
      "startTime",
      "duration",
    ]);
  if (type === "consensus-model-complete")
    return pick(data, [
      "playerId",
      "provider",
      "index",
      "duration",
      "success",
      "aborted",
      "timeout",
      "error",
    ]);
  if (type === "consensus-voting")
    return {
      ...pick(data, ["playerId", "actionId", "votingDuration", "currentPhase"]),
      // The winner is about to be played; the moves it beat never are
      ...pick(data, ["topResult"]),
      allResults: [],
      gameState: publicPayload(data["gameState"]),
    };
  return pick(data, ["playerId", "turn"]);
};

export function viewLogEntry(
  entry: LLMLogEntry,
  viewerId: string | null,
): LLMLogEntry {
  const data = entry.data ?? {};
  if (viewerId !== null && data["playerId"] === viewerId) return entry;
  return { ...entry, data: redact(entry.type, data) };
}
