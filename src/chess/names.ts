import type { ChessPlayerId, ChessPlayerOrder } from "./shape";

/** A player is their colour, unless the caller knows a name for the id */
export const playerLabel = (
  playerOrder: ChessPlayerOrder,
  names: Record<string, string>,
  id: ChessPlayerId,
): string => names[id] ?? (id === playerOrder[0] ? "White" : "Black");
