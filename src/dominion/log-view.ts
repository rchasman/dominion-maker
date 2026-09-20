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
  "decisionType",
] as const;

/**
 * `handCounts` splits the hidden hand into treasures and actions, which the
 * state view never discloses. Only the size the table can count survives.
 */
const publicPayload = (payload: unknown): Payload => {
  if (!isRecord(payload)) return {};
  return {
    ...pick(payload, PUBLIC_PAYLOAD_KEYS),
    handSize: countOf(payload["hand"]),
    activePlayerId: publicPlayer(payload["activePlayerId"]),
  };
};

/**
 * One projection per entry type. A type absent from this map is projected
 * blind: its data is stripped to the seat and its message replaced, because
 * a message nobody has read can name a card nobody may see. A rejected
 * command stringified into `consensus-step-error` is exactly that.
 */
type Project = (data: Payload) => Payload;

const PROJECTIONS = new Map<string, Project>([
  [
    "ai-turn-start",
    data => pick(data, ["playerId", "turn", "phase", "providers"]),
  ],
  [
    "ai-decision-resolving",
    data => pick(data, ["playerId", "turn", "decisionType"]),
  ],
  ["consensus-skipped", data => pick(data, ["playerId", "turn", "action"])],
  [
    "consensus-start",
    data => ({
      ...pick(data, ["playerId", "providers", "totalModels", "phase", "turn"]),
      gameState: publicPayload(data["gameState"]),
    }),
  ],
  [
    "consensus-model-pending",
    data => pick(data, ["playerId", "provider", "index", "startTime"]),
  ],
  [
    "consensus-model-aborted",
    data => pick(data, ["playerId", "provider", "index", "duration"]),
  ],
  [
    "consensus-model-complete",
    data =>
      pick(data, [
        "playerId",
        "provider",
        "index",
        "duration",
        "success",
        "aborted",
        "timeout",
        "error",
      ]),
  ],
  [
    "consensus-voting",
    data => ({
      ...pick(data, ["playerId", "actionId", "votingDuration", "currentPhase"]),
      // The winner is about to be played; the moves it beat never are
      ...pick(data, ["topResult"]),
      allResults: [],
      gameState: publicPayload(data["gameState"]),
    }),
  ],
]);

const seatOf = (data: Payload): string =>
  typeof data["playerId"] === "string" ? data["playerId"] : "a seat";

export function viewLogEntry(
  entry: LLMLogEntry,
  viewerId: string | null,
): LLMLogEntry {
  const data = entry.data ?? {};
  if (viewerId !== null && data["playerId"] === viewerId) return entry;
  const project = PROJECTIONS.get(entry.type);
  if (!project) {
    return {
      ...entry,
      message: `${entry.type} for ${seatOf(data)}`,
      data: pick(data, ["playerId", "turn"]),
    };
  }
  return { ...entry, data: project(data) };
}
