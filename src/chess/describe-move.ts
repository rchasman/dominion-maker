import type { Move } from "chess.js";

export type PieceName =
  | "Pawn"
  | "Knight"
  | "Bishop"
  | "Rook"
  | "Queen"
  | "King";

const PIECE_NAMES: Record<string, PieceName> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

export const pieceName = (symbol: string): PieceName =>
  PIECE_NAMES[symbol] ?? "Pawn";

/** Everything a move did beyond landing a piece on a square */
export type ChessMoveEvent =
  | { kind: "capture"; piece: PieceName }
  | { kind: "en-passant" }
  | { kind: "castle"; side: "kingside" | "queenside" }
  | { kind: "promotion"; piece: PieceName }
  | { kind: "check" }
  | { kind: "checkmate" };

export type DescribedMove = {
  san: string;
  piece: PieceName;
  to: string;
  events: ChessMoveEvent[];
};

/** chess.js has no isCheck on a Move; the SAN suffix is the record of it */
const checkEvents = (san: string): ChessMoveEvent[] => {
  if (san.endsWith("#")) return [{ kind: "checkmate" }];
  if (san.endsWith("+")) return [{ kind: "check" }];
  return [];
};

const when = (applies: boolean, event: ChessMoveEvent): ChessMoveEvent[] =>
  applies ? [event] : [];

export const describeMove = (move: Move): DescribedMove => ({
  san: move.san,
  piece: pieceName(move.piece),
  to: move.to,
  events: [
    ...when(move.captured !== undefined, {
      kind: "capture",
      piece: pieceName(move.captured ?? ""),
    }),
    ...when(move.isEnPassant(), { kind: "en-passant" }),
    ...when(move.isKingsideCastle(), { kind: "castle", side: "kingside" }),
    ...when(move.isQueensideCastle(), { kind: "castle", side: "queenside" }),
    ...when(move.promotion !== undefined, {
      kind: "promotion",
      piece: pieceName(move.promotion ?? ""),
    }),
    ...checkEvents(move.san),
  ],
});

export const eventText = (event: ChessMoveEvent): string => {
  switch (event.kind) {
    case "capture":
      return `Takes ${event.piece}`;
    case "en-passant":
      return "En passant";
    case "castle":
      return `Castles ${event.side}`;
    case "promotion":
      return `Promotes to ${event.piece}`;
    case "check":
      return "Check";
    case "checkmate":
      return "Checkmate";
  }
};
