import { Chess } from "chess.js";
import type { PromptInput } from "../core/game-definition";
import {
  formatNumberedMoves,
  replyFormatInstruction,
  replyShape,
} from "../core/consensus/numbered-choice";
import {
  captureOf,
  captureText,
  castlingText,
  describeMaterial,
  effectTexts,
  legalMoveFacts,
  pieceAtRiskText,
  PIECE_VALUES_TEXT,
  pieceGroupsText,
  positionFacts,
  worthText,
  type MoveFacts,
  type OfferedMove,
  type PositionFacts,
} from "./facts";
import type { ChessShape } from "./shape";

export const RECALLED_MOVES = 8;

export const colourName = (colour: "w" | "b"): "White" | "Black" =>
  colour === "w" ? "White" : "Black";

/** A fact column with nothing to report; TOON would quote a bare dash */
const NONE = "none";

/** The capture has its own column, so the effect column carries everything else the move does */
const effectColumn = (facts: MoveFacts): string => {
  const effects = effectTexts({
    ...facts,
    events: facts.events.filter(event => event.kind !== "capture"),
  });
  return effects.length > 0 ? effects.join(", ") : NONE;
};

/** One row of the numbered table: the move and the facts chess.js proves about it */
const chessPromptRow = ({
  facts,
}: OfferedMove): Record<string, string | number> => {
  const capture = captureOf(facts);
  return {
    san: facts.san,
    piece: facts.piece,
    from: facts.from,
    to: facts.to,
    takes: capture === null ? NONE : worthText(capture),
    effect: effectColumn(facts),
    attackers: facts.attackers,
    defenders: facts.defenders,
    cheapestAttacker:
      facts.cheapestAttacker === null
        ? NONE
        : worthText(facts.cheapestAttacker),
    opponentBestCapture:
      facts.opponentBestCapture === null
        ? NONE
        : captureText(facts.opponentBestCapture),
  };
};

const GUIDANCE = `GUIDANCE (read the fact columns, not the picture):
- takes names the piece the move captures and its value in pawns; effect lists check, checkmate, castling, promotion and en passant. A checkmate ends the game won: play it.
- attackers counts the enemy pieces that can legally take on the landing square once the move is made; a pinned piece is not one. defenders counts your pieces that can legally take back after the cheapest of them captures. With defenders 0, a capture on that square cannot be answered by a recapture, so the piece is lost for whatever takes is worth. cheapestAttacker is the least valuable attacker: when its value is below the moving piece's value, even a recapture leaves you down by the difference.
- opponentBestCapture is the most valuable piece of yours the opponent can take with one legal reply, and the square it stands on. Set it against takes: a move that wins less than that reply loses material.
- PIECES is the whole board: every piece of each side and the square it stands on. A piece absent from PIECES is off the board; do not infer one from the grid or from the moves played.
- RECENT MOVES were already played. A piece named there may since have moved or been captured; the position is PIECES, not the move list.
- The POSITION section lists your pieces that can be taken and not taken back right now, and the opponent's best capture if you do nothing. A move whose row leaves that piece defended, moved or its attacker taken changes those facts; check the row.`;

/**
 * The reply rules live in the system text, matching Dominion, because the
 * models were live-verified against prose plus response_format rather than
 * response_format alone.
 */
function systemPrompt(choiceCount: number): string {
  return `You are playing chess against one opponent. Moves are written in standard algebraic notation (SAN). Piece values in pawns: ${PIECE_VALUES_TEXT}; the king has no value because it is never captured.

The user message gives you the position as a FEN string and an ASCII board, then facts chess.js computed: the material per side, the castling rights, every piece of each side by square, your pieces that can be taken and not taken back, the opponent's best capture if you did nothing, and the moves already played. LEGAL MOVES is a numbered table of every move you may play right now. Each row states what the rules prove about that move: piece, from and to, takes (the captured piece and its value), effect (check, checkmate, castling, promotion, en passant), attackers and defenders (enemy pieces that can legally take on the landing square once the move is made, and your pieces that can legally take back), cheapestAttacker (the least valuable of those attackers) and opponentBestCapture (the most valuable piece of yours the opponent can take with one legal reply, and its square). Pick exactly one entry by its number. Never invent a move that is not in the table.

OUTPUT FORMAT: reply with ONLY this JSON object, no other text and no markdown fences. Write your reasoning FIRST, then the choice. Give the decisive point of the move in 1-2 sentences:
${replyShape("<number from LEGAL MOVES>")}

${replyFormatInstruction(choiceCount)}

${GUIDANCE}`;
}

const threatLine = (facts: PositionFacts): string => {
  if (facts.inCheck) return "you are in check and must answer it first";
  return facts.opponentBestCapture === null
    ? NONE
    : captureText(facts.opponentBestCapture);
};

/** The facts of the position as chess.js counts them, before any move is weighed */
const positionSection = (facts: PositionFacts): string => {
  const { material, pieces, undefended } = facts;
  const atRisk =
    undefended.length > 0 ? undefended.map(pieceAtRiskText).join("; ") : NONE;
  return [
    `MATERIAL: White ${material.white}, Black ${material.black}. ${describeMaterial(material)}`,
    `CASTLING RIGHTS: ${castlingText(facts.castling)}.`,
    `PIECES (every piece on the board by square; K king, Q queen, R rook, B bishop, N knight, P pawn):\nWhite: ${pieceGroupsText(pieces.white)}\nBlack: ${pieceGroupsText(pieces.black)}`,
    `YOUR PIECES ATTACKED AND UNDEFENDED: ${atRisk}.`,
    `OPPONENT'S BEST CAPTURE IF YOU DO NOTHING: ${threatLine(facts)}.`,
  ].join("\n");
};

export function chessPrompt({
  state,
  player,
  moves,
  customStrategy,
}: PromptInput<ChessShape>): { system: string; user: string } {
  const facts = positionFacts(state.fen);
  const colour = colourName(facts.sideToMove);
  const check = state.inCheck ? " You are in check." : "";
  const recent = state.moves.slice(-RECALLED_MOVES);
  const strategy = customStrategy.trim();

  const sections = [
    `YOU ARE: ${player}, playing ${colour}. It is your move.${check}`,
    `FEN: ${state.fen}`,
    `BOARD:\n${new Chess(state.fen).ascii()}`,
    positionSection(facts),
    ...(recent.length > 0
      ? [`RECENT MOVES (already played, not the position): ${recent.join(" ")}`]
      : []),
    ...(strategy.length > 0 ? [`STRATEGY OVERRIDE:\n${strategy}`] : []),
    `LEGAL MOVES (choose exactly one by number; the columns are facts the rules prove):\n${formatNumberedMoves(legalMoveFacts(state.fen, moves), chessPromptRow)}`,
  ];

  return {
    system: systemPrompt(moves.length),
    user: sections.join("\n\n"),
  };
}
