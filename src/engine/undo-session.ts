import type { GameEvent, PlayerId } from "../events/types";
import type { CommandResult } from "../commands/types";
import { generateEventId } from "../events/id-generator";

export type PendingUndoRequest = {
  requestId: string;
  byPlayer: PlayerId;
  toEventId: string;
  reason?: string;
  approvals: Set<PlayerId>;
  needed: number;
};

/** Session negotiation is reconstructed from its events, independently of rules. */
export function projectUndoRequest(
  events: readonly GameEvent[],
  players: PlayerId[],
): PendingUndoRequest | null {
  let pending: PendingUndoRequest | null = null;
  for (const event of events) {
    if (event.type === "UNDO_REQUESTED") {
      pending = {
        requestId: event.requestId,
        byPlayer: event.byPlayer,
        toEventId: event.toEventId,
        ...(event.reason !== undefined && { reason: event.reason }),
        approvals: new Set(),
        needed: players.filter(id => id !== event.byPlayer).length,
      };
    } else if (
      event.type === "UNDO_APPROVED" &&
      pending?.requestId === event.requestId
    ) {
      pending.approvals.add(event.byPlayer);
    } else if (
      event.type === "UNDO_EXECUTED" ||
      (event.type === "UNDO_DENIED" && pending?.requestId === event.requestId)
    ) {
      pending = null;
    }
  }
  return pending;
}

export function respondToUndo(
  pending: PendingUndoRequest | null,
  command: {
    type: "APPROVE_UNDO" | "DENY_UNDO";
    playerId: PlayerId;
    requestId: string;
  },
  players: PlayerId[],
  history: readonly GameEvent[],
): CommandResult {
  if (!pending) return { ok: false, error: "No pending undo request" };
  if (pending.requestId !== command.requestId)
    return { ok: false, error: "Request ID mismatch" };
  if (
    !players.includes(command.playerId) ||
    command.playerId === pending.byPlayer
  )
    return { ok: false, error: "Only opponents can respond to undo" };
  if (command.type === "DENY_UNDO")
    return {
      ok: true,
      events: [
        {
          type: "UNDO_DENIED",
          requestId: command.requestId,
          byPlayer: command.playerId,
          id: generateEventId(),
        },
      ],
    };
  if (pending.approvals.has(command.playerId))
    return { ok: false, error: "Already approved" };
  const approval: GameEvent = {
    type: "UNDO_APPROVED",
    requestId: command.requestId,
    byPlayer: command.playerId,
    id: generateEventId(),
  };
  if (pending.approvals.size + 1 < pending.needed)
    return { ok: true, events: [approval] };
  if (!history.some(event => event.id === pending.toEventId))
    return { ok: false, error: "Target event not found" };
  return {
    ok: true,
    events: [
      approval,
      {
        type: "UNDO_EXECUTED",
        fromEventId: history.at(-1)?.id ?? "",
        toEventId: pending.toEventId,
        id: generateEventId(),
      },
    ],
  };
}
