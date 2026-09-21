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

/** Everything a move did beyond its action */
export type ChessMoveEvent =
  | { kind: "capture"; piece: PieceName }
  | { kind: "en-passant" }
  | { kind: "promotion"; piece: PieceName }
  | { kind: "check" }
  | { kind: "checkmate" };

/** What the mover did: put a piece somewhere, or castle */
export type ChessMoveAction =
  | { kind: "move"; piece: PieceName; to: string }
  | { kind: "castle"; side: "kingside" | "queenside" };

export type DescribedMove = {
  san: string;
  action: ChessMoveAction;
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

const actionOf = (move: Move): ChessMoveAction => {
  if (move.isKingsideCastle()) return { kind: "castle", side: "kingside" };
  if (move.isQueensideCastle()) return { kind: "castle", side: "queenside" };
  return { kind: "move", piece: pieceName(move.piece), to: move.to };
};

export const describeMove = (move: Move): DescribedMove => ({
  san: move.san,
  action: actionOf(move),
  events: [
    ...when(move.captured !== undefined, {
      kind: "capture",
      piece: pieceName(move.captured ?? ""),
    }),
    ...when(move.isEnPassant(), { kind: "en-passant" }),
    ...when(move.promotion !== undefined, {
      kind: "promotion",
      piece: pieceName(move.promotion ?? ""),
    }),
    ...checkEvents(move.san),
  ],
});

/** The words of an event: a verb, and the piece it acts on where there is one */
export type EventPhrase = { verb: string; noun: PieceName | null };

export const eventPhrase = (event: ChessMoveEvent): EventPhrase => {
  switch (event.kind) {
    case "capture":
      return { verb: "takes", noun: event.piece };
    case "en-passant":
      return { verb: "en passant", noun: null };
    case "promotion":
      return { verb: "promotes to", noun: event.piece };
    case "check":
      return { verb: "gives check", noun: null };
    case "checkmate":
      return { verb: "checkmates", noun: null };
  }
};

/** A fact for a model to hold, sentence-case, as the Jev prompt states it */
export const eventText = (event: ChessMoveEvent): string => {
  const phrase = eventPhrase(event);
  const verb = {
    capture: "Takes",
    "en-passant": "En passant",
    promotion: "Promotes to",
    check: "Check",
    checkmate: "Checkmate",
  }[event.kind];
  return phrase.noun === null ? verb : `${verb} ${phrase.noun}`;
};

/** Everything a move did, as facts: castling first where it applies, then each event */
export const moveFacts = (described: DescribedMove): string[] => [
  ...(described.action.kind === "castle"
    ? [`Castles ${described.action.side}`]
    : []),
  ...described.events.map(eventText),
];
