/**
 * What chess.js proves about a position and the moves it allows. The text
 * voters, Jev, the vote labels, the heuristic, the move log and the eval all
 * read from here, so each fact is computed once and means the same thing
 * wherever it is shown.
 */

import {
  Chess,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";
import { plural } from "../lib/plural";
import type { ChessMove } from "./shape";

export type PieceName =
  | "Pawn"
  | "Knight"
  | "Bishop"
  | "Rook"
  | "Queen"
  | "King";

const PIECE_NAMES: Record<PieceSymbol, PieceName> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const PIECE_SYMBOLS: Record<PieceName, PieceSymbol> = {
  Pawn: "p",
  Knight: "n",
  Bishop: "b",
  Rook: "r",
  Queen: "q",
  King: "k",
};

const pieceName = (symbol: PieceSymbol): PieceName => PIECE_NAMES[symbol];

type ValuedPiece = Exclude<PieceSymbol, "k">;

/** Highest first: the order the scale is read out in */
const VALUED_PIECES: readonly ValuedPiece[] = ["q", "r", "b", "n", "p"];

/** Material worth in pawns; the king is never captured, so it has none */
const PIECE_VALUES: Record<ValuedPiece, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
};

const isValued = (symbol: PieceSymbol): symbol is ValuedPiece => symbol !== "k";

/** "queen 9, rook 5, bishop 3, knight 3, pawn 1": the scale every value shown to a model is on */
export const PIECE_VALUES_TEXT = VALUED_PIECES.map(
  symbol => `${PIECE_NAMES[symbol].toLowerCase()} ${PIECE_VALUES[symbol]}`,
).join(", ");

/** Worth in pawns; null for the king */
export const pieceValue = (symbol: PieceSymbol): number | null =>
  isValued(symbol) ? PIECE_VALUES[symbol] : null;

const worthOf = (piece: PieceName): number | null =>
  pieceValue(PIECE_SYMBOLS[piece]);

export const capturedValue = (symbol: PieceSymbol): number => {
  const value = pieceValue(symbol);
  if (value === null) throw new Error("A king cannot be captured");
  return value;
};

export const opponentOf = (colour: Color): Color =>
  colour === "w" ? "b" : "w";

type Material = { white: number; black: number };

/** Each side's material on the board, in pawns */
export const materialOf = (board: Chess): Material =>
  board
    .board()
    .flat()
    .reduce<Material>(
      (tally, cell) => {
        if (cell === null) return tally;
        const value = pieceValue(cell.type) ?? 0;
        return cell.color === "w"
          ? { ...tally, white: tally.white + value }
          : { ...tally, black: tally.black + value };
      },
      { white: 0, black: 0 },
    );

/** The lead in words, so a voter that reads numbers as text still knows who is ahead */
export const describeMaterial = ({ white, black }: Material): string => {
  if (white === black) return "Material is level.";
  const leader = white > black ? "White" : "Black";
  const lead = Math.abs(white - black);
  return `${leader} is ahead by ${plural(lead, "pawn")} of material.`;
};

/** Everything a move did beyond its action */
export type ChessMoveEvent =
  | { kind: "capture"; piece: PieceName; value: number }
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

const captureEvents = (captured: PieceSymbol | undefined): ChessMoveEvent[] =>
  captured === undefined
    ? []
    : [
        {
          kind: "capture",
          piece: pieceName(captured),
          value: capturedValue(captured),
        },
      ];

const promotionEvents = (
  promotion: PieceSymbol | undefined,
): ChessMoveEvent[] =>
  promotion === undefined
    ? []
    : [{ kind: "promotion", piece: pieceName(promotion) }];

const actionOf = (move: Move): ChessMoveAction => {
  if (move.isKingsideCastle()) return { kind: "castle", side: "kingside" };
  if (move.isQueensideCastle()) return { kind: "castle", side: "queenside" };
  return { kind: "move", piece: pieceName(move.piece), to: move.to };
};

/** What one move did on the board, read off chess.js's record of it */
export const describeMove = (move: Move): DescribedMove => ({
  san: move.san,
  action: actionOf(move),
  events: [
    ...captureEvents(move.captured),
    ...when(move.isEnPassant(), { kind: "en-passant" }),
    ...promotionEvents(move.promotion),
    ...checkEvents(move.san),
  ],
});

/** The words of an event as the move log shows them: a verb, and the piece it acts on where there is one */
type EventPhrase = { verb: string; noun: PieceName | null };

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

/** A piece and its worth in pawns; the king has none */
type PieceWorth = { piece: PieceName; value: number | null };

/** "Bishop 3", or "King" */
export const worthText = ({ piece, value }: PieceWorth): string =>
  value === null ? piece : `${piece} ${value}`;

/** An event as a fact for a model or a label: "takes Bishop 3", "check" */
const eventText = (event: ChessMoveEvent): string => {
  switch (event.kind) {
    case "capture":
      return `takes ${worthText(event)}`;
    case "en-passant":
      return "en passant";
    case "promotion":
      return `promotes to ${event.piece}`;
    case "check":
      return "check";
    case "checkmate":
      return "checkmate";
  }
};

/** Everything a move did, in words: castling first where it applies, then each event */
export const effectTexts = (described: DescribedMove): string[] => [
  ...(described.action.kind === "castle"
    ? [`castles ${described.action.side}`]
    : []),
  ...described.events.map(eventText),
];

export const captureOf = (
  described: DescribedMove,
): (ChessMoveEvent & { kind: "capture" }) | null =>
  described.events.find(event => event.kind === "capture") ?? null;

/** A piece the opponent can take: what it is, what it is worth and where it stands */
export type Capture = { piece: PieceName; value: number; square: string };

/** "Queen 9 on d1" */
export const captureText = (capture: Capture): string =>
  `${worthText(capture)} on ${capture.square}`;

/** Who can take on a square and who can take back, judged by the legal moves */
type Landing = {
  /** Enemy pieces with a legal capture on the square: a pinned piece, or one whose capture leaves its king in check, is not one */
  attackers: number;
  /** The least valuable of those attackers; the king, having no value, comes last */
  cheapestAttacker: PieceWorth | null;
  /**
   * Own pieces that can legally take back once the cheapest attacker has
   * captured. With no legal capture on the square there is nothing to take
   * back, so the count is of the pieces that guard the square geometrically.
   */
  defenders: number;
};

/** What chess.js proves about one legal move, one move ahead */
export type MoveFacts = DescribedMove &
  Landing & {
    piece: PieceName;
    from: string;
    to: string;
    /** The most valuable piece the opponent can take with one legal reply */
    opponentBestCapture: Capture | null;
  };

const worthOfMover = (move: Move): PieceWorth => ({
  piece: pieceName(move.piece),
  value: pieceValue(move.piece),
});

const cheaperMover = (best: Move, next: Move): Move =>
  (pieceValue(next.piece) ?? Number.POSITIVE_INFINITY) <
  (pieceValue(best.piece) ?? Number.POSITIVE_INFINITY)
    ? next
    : best;

const cheapestMover = (moves: Move[]): Move | null => {
  const [first, ...rest] = moves;
  return first === undefined ? null : rest.reduce(cheaperMover, first);
};

/** The captured pawn of an en passant capture stands beside the capturing pawn's start, not on its landing square */
export const capturedSquare = (reply: Move): string =>
  reply.isEnPassant() ? `${reply.to[0]}${reply.from[1]}` : reply.to;

/** The legal moves that take the piece on `square`, one per capturing piece: a promotion's four choices are one capture */
const takersOf = (legal: readonly Move[], square: string): Move[] => [
  ...new Map(
    legal
      .filter(reply => capturedSquare(reply) === square)
      .map(reply => [reply.from, reply]),
  ).values(),
];

/**
 * What the side to move can do to the piece on `square`, and what its owner
 * can do back: `legal` is that side's legal moves on `board`.
 */
const landingOf = (
  board: Chess,
  legal: readonly Move[],
  square: Square,
  owner: Color,
): Landing => {
  const takers = takersOf(legal, square);
  const cheapest = cheapestMover(takers);
  if (cheapest === null)
    return {
      attackers: 0,
      cheapestAttacker: null,
      defenders: board.attackers(square, owner).length,
    };
  const taken = new Chess(cheapest.after);
  return {
    attackers: takers.length,
    cheapestAttacker: worthOfMover(cheapest),
    defenders: takersOf(taken.moves({ verbose: true }), cheapest.to).length,
  };
};

const richer = (best: Capture, next: Capture): Capture =>
  next.value > best.value ? next : best;

/** The most valuable piece the given legal moves can take, with the square it stands on */
const bestCapture = (legal: readonly Move[]): Capture | null => {
  const captures = legal.flatMap(reply =>
    reply.captured === undefined
      ? []
      : [
          {
            piece: pieceName(reply.captured),
            value: capturedValue(reply.captured),
            square: capturedSquare(reply),
          },
        ],
  );
  const [first, ...rest] = captures;
  return first === undefined ? null : rest.reduce(richer, first);
};

/** The facts of one move chess.js has recorded, read off the position it leaves */
export const moveFacts = (move: Move): MoveFacts => {
  const after = new Chess(move.after);
  const replies = after.moves({ verbose: true });
  return {
    ...describeMove(move),
    ...landingOf(after, replies, move.to, move.color),
    piece: pieceName(move.piece),
    from: move.from,
    to: move.to,
    opponentBestCapture: bestCapture(replies),
  };
};

const legalBySan = (fen: string): Map<string, Move> =>
  new Map(
    new Chess(fen).moves({ verbose: true }).map(move => [move.san, move]),
  );

/**
 * A move the rules refuse throws: the offered moves were built from this same
 * position, so one marks a caller bug rather than a choice to describe.
 */
const lookup = (legal: Map<string, Move>, fen: string, san: string): Move => {
  const move = legal.get(san);
  if (!move) throw new Error(`${san} is not legal in ${fen}`);
  return move;
};

/** An offered move with the facts behind it */
export type OfferedMove = { move: ChessMove; facts: MoveFacts };

/** The facts behind each offered move, in the order given */
export const legalMoveFacts = (
  fen: string,
  moves: readonly ChessMove[],
): OfferedMove[] => {
  const legal = legalBySan(fen);
  return moves.map(move => ({
    move,
    facts: moveFacts(lookup(legal, fen, move.san)),
  }));
};

/**
 * The moved piece can be taken and nothing can take back, and the move itself
 * won less than the piece is worth. A king never hangs: it may not land on an
 * attacked square. A promoted piece is judged at the pawn's worth: losing it
 * costs the pawn that was pushed, not the piece it briefly became.
 */
export const hangsMovedPiece = (facts: MoveFacts): boolean => {
  const worth = worthOf(facts.piece);
  return (
    worth !== null &&
    facts.attackers > 0 &&
    facts.defenders === 0 &&
    (captureOf(facts)?.value ?? 0) < worth
  );
};

/**
 * The moved piece lands where a cheaper enemy piece attacks it, and the move
 * itself won less than the difference: even a recapture leaves material down.
 */
export const landsOnCheaperAttacker = (facts: MoveFacts): boolean => {
  const worth = worthOf(facts.piece);
  const attacker = facts.cheapestAttacker?.value ?? null;
  return (
    worth !== null &&
    attacker !== null &&
    attacker < worth &&
    (captureOf(facts)?.value ?? 0) < worth - attacker
  );
};

const landingText = (facts: MoveFacts): string => {
  const cheapest =
    facts.cheapestAttacker === null
      ? ""
      : ` (${worthText(facts.cheapestAttacker)})`;
  return `attacked ${facts.attackers}${cheapest} / defended ${facts.defenders}`;
};

export const isCheckmate = (facts: DescribedMove): boolean =>
  facts.events.some(event => event.kind === "checkmate");

/**
 * The label a vote carries: "Nxe5 takes Bishop 3, check; attacked 1 (Pawn 1)
 * / defended 2; reply takes Queen 9 on d1". Every clause is a fact above.
 */
const describeFacts = (facts: MoveFacts): string => {
  const effects = effectTexts(facts);
  const head =
    effects.length > 0 ? `${facts.san} ${effects.join(", ")}` : facts.san;
  if (isCheckmate(facts)) return head;
  const reply =
    facts.opponentBestCapture === null
      ? []
      : [`reply takes ${captureText(facts.opponentBestCapture)}`];
  return [head, landingText(facts), ...reply].join("; ");
};

/** The label of one offered move; throws when the rules refuse it */
export const legalMoveLabel = (fen: string, move: ChessMove): string =>
  describeFacts(moveFacts(lookup(legalBySan(fen), fen, move.san)));

type CastlingRights = { kingside: boolean; queenside: boolean };

/** One of the mover's pieces an enemy can legally take and no own piece can take back */
type PieceAtRisk = Capture & {
  attackers: number;
  cheapestAttacker: PieceWorth;
};

/** One side's pieces of one kind and the squares they stand on, files first */
export type PieceGroup = { piece: PieceName; squares: Square[] };

type Pieces = { white: PieceGroup[]; black: PieceGroup[] };

export type PositionFacts = {
  sideToMove: Color;
  inCheck: boolean;
  material: Material;
  castling: { white: CastlingRights; black: CastlingRights };
  /** Every piece on the board by square, so nothing has to be read off a grid or inferred from the moves played */
  pieces: Pieces;
  /**
   * The mover's pieces an enemy can legally take and no own piece can take
   * back, judged as the move rows are. Empty in check, where the opponent has
   * no move to make until the check is answered; the king is covered by inCheck.
   */
  undefended: PieceAtRisk[];
  /**
   * The most valuable piece the opponent could take if it were to move now.
   * Null in check, where every reply must answer the check first.
   */
  opponentBestCapture: Capture | null;
};

const castlingRightsOf = (board: Chess, colour: Color): CastlingRights => {
  const rights = board.getCastlingRights(colour);
  return { kingside: rights.k, queenside: rights.q };
};

/** Kings first, then down the value scale: the order a side's pieces are listed in */
const PIECE_ORDER: readonly PieceSymbol[] = ["k", ...VALUED_PIECES];

const pieceGroupsOf = (board: Chess, colour: Color): PieceGroup[] => {
  const own = board
    .board()
    .flat()
    .flatMap(cell => (cell !== null && cell.color === colour ? [cell] : []));
  return PIECE_ORDER.flatMap(type => {
    const squares = own
      .filter(cell => cell.type === type)
      .map(cell => cell.square);
    return squares.length === 0
      ? []
      : [{ piece: pieceName(type), squares: [...squares].sort() }];
  });
};

/**
 * The mover's pieces the opponent could take for nothing if it were to move
 * now: `handedOver` is the position with the move passed to the opponent.
 */
const undefendedPieces = (board: Chess, handedOver: Chess): PieceAtRisk[] => {
  const mover = board.turn();
  const replies = handedOver.moves({ verbose: true });
  return board
    .board()
    .flat()
    .flatMap(cell => {
      if (cell === null || cell.color !== mover || cell.type === "k") return [];
      const landing = landingOf(handedOver, replies, cell.square, mover);
      if (landing.cheapestAttacker === null || landing.defenders > 0) return [];
      return [
        {
          piece: pieceName(cell.type),
          value: capturedValue(cell.type),
          square: cell.square,
          attackers: landing.attackers,
          cheapestAttacker: landing.cheapestAttacker,
        },
      ];
    });
};

/**
 * The position with the move handed to the opponent, so its captures can be
 * read as legal moves. Null in check: the mover must answer the check, and a
 * board where the checked side has passed is not a legal position.
 */
const handOver = (board: Chess): Chess | null => {
  if (board.inCheck()) return null;
  const handedOver = new Chess(board.fen());
  handedOver.setTurn(opponentOf(board.turn()));
  return handedOver;
};

export const positionFacts = (fen: string): PositionFacts => {
  const board = new Chess(fen);
  const handedOver = handOver(board);
  return {
    sideToMove: board.turn(),
    inCheck: board.inCheck(),
    material: materialOf(board),
    castling: {
      white: castlingRightsOf(board, "w"),
      black: castlingRightsOf(board, "b"),
    },
    pieces: {
      white: pieceGroupsOf(board, "w"),
      black: pieceGroupsOf(board, "b"),
    },
    undefended: handedOver === null ? [] : undefendedPieces(board, handedOver),
    opponentBestCapture:
      handedOver === null
        ? null
        : bestCapture(handedOver.moves({ verbose: true })),
  };
};

/** "K e1, Q d1, R a1 h1, B c1 f1, N b1 g1, P a2 b2 c2 d2 e2 f2 g2 h2" */
export const pieceGroupsText = (groups: readonly PieceGroup[]): string =>
  groups
    .map(
      ({ piece, squares }) =>
        `${PIECE_SYMBOLS[piece].toUpperCase()} ${squares.join(" ")}`,
    )
    .join(", ");

const rightsText = ({ kingside, queenside }: CastlingRights): string => {
  if (kingside && queenside) return "kingside and queenside";
  if (kingside) return "kingside only";
  if (queenside) return "queenside only";
  return "none";
};

/** "White kingside and queenside; Black none" */
export const castlingText = (castling: PositionFacts["castling"]): string =>
  `White ${rightsText(castling.white)}; Black ${rightsText(castling.black)}`;

/** "Knight 3 on e5 (attacked by 2, cheapest Pawn 1)" */
export const pieceAtRiskText = (piece: PieceAtRisk): string =>
  `${captureText(piece)} (attacked by ${piece.attackers}, cheapest ${worthText(piece.cheapestAttacker)})`;
