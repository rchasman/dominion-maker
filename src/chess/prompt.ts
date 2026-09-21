import { Chess } from "chess.js";
import type { PromptInput } from "../core/game-definition";
import {
  formatNumberedMoves,
  replyFormatInstruction,
  replyShape,
} from "../core/consensus/numbered-choice";
import type { ChessMove, ChessShape } from "./shape";

export const RECALLED_MOVES = 8;

export const colourName = (colour: "w" | "b"): "White" | "Black" =>
  colour === "w" ? "White" : "Black";

export const colourToMove = (board: Chess): "White" | "Black" =>
  colourName(board.turn());

/** One row of the numbered table; SAN already names both squares */
const chessPromptRow = (move: ChessMove) => ({ san: move.san });

const GUIDANCE = `GUIDANCE:
- Develop your minor pieces towards the centre before moving the same piece twice.
- Keep your king safe: castle early and avoid opening lines in front of it.
- Count material before and after a trade; a piece is worth more than a pawn.
- Do not hang pieces. Before you commit, check what the opponent captures in reply.`;

/**
 * The reply rules live in the system text, matching Dominion, because the
 * models were live-verified against prose plus response_format rather than
 * response_format alone.
 */
function systemPrompt(choiceCount: number): string {
  return `You are playing chess against one opponent. Moves are written in standard algebraic notation (SAN).

The user message gives you the position as a FEN string and an ASCII board, the moves played recently, and LEGAL MOVES: a numbered table of every move you may play right now. Pick exactly one entry by its number. Never invent a move that is not in the table.

OUTPUT FORMAT: reply with ONLY this JSON object, no other text and no markdown fences. Write your reasoning FIRST, then the choice. Give the decisive point of the move in 1-2 sentences:
${replyShape("<number from LEGAL MOVES>")}

${replyFormatInstruction(choiceCount)}

${GUIDANCE}`;
}

export function chessPrompt({
  state,
  player,
  moves,
  customStrategy,
}: PromptInput<ChessShape>): { system: string; user: string } {
  const board = new Chess(state.fen);
  const colour = colourToMove(board);
  const check = state.inCheck ? " You are in check." : "";
  const recent = state.moves.slice(-RECALLED_MOVES);
  const strategy = customStrategy.trim();

  const sections = [
    `YOU ARE: ${player}, playing ${colour}. It is your move.${check}`,
    `FEN: ${state.fen}`,
    `BOARD:\n${board.ascii()}`,
    ...(recent.length > 0 ? [`RECENT MOVES: ${recent.join(" ")}`] : []),
    ...(strategy.length > 0 ? [`STRATEGY OVERRIDE:\n${strategy}`] : []),
    `LEGAL MOVES (choose exactly one by number):\n${formatNumberedMoves(moves, chessPromptRow)}`,
  ];

  return {
    system: systemPrompt(moves.length),
    user: sections.join("\n\n"),
  };
}
