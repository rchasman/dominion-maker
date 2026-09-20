import { Chess } from "chess.js";
import { run } from "../lib/run";
import { sideToMove } from "./engine";
import type { ChessCommand, ChessPlayerId, ChessState } from "./shape";

/** Material worth of a captured piece; the king is never captured */
const PIECE_VALUES: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };

type Candidate = { san: string; to: string; captured?: string | undefined };

const valueOf = (candidate: Candidate): number =>
  candidate.captured === undefined
    ? 0
    : (PIECE_VALUES[candidate.captured] ?? 0);

const richer = (best: Candidate, next: Candidate): Candidate =>
  valueOf(next) > valueOf(best) ? next : best;

const playOn = (fen: string, san: string): Chess => {
  const board = new Chess(fen);
  board.move(san);
  return board;
};

const isMate = (fen: string, san: string): boolean =>
  playOn(fen, san).isCheckmate();

/**
 * The crudest safety check there is: after the capture, may any enemy pawn
 * legally step onto the square we just landed on? It misses every other
 * recapture, which is the point. A rules bot that only avoids pawn takes is
 * predictable, and the seat driver needs a fast answer, not a good one.
 */
const takenByAPawn = (fen: string, candidate: Candidate): boolean =>
  playOn(fen, candidate.san)
    .moves({ verbose: true })
    .some(reply => reply.piece === "p" && reply.to === candidate.to);

/** FNV-1a over the FEN, so the same position always seeds the same draw */
const hashOf = (text: string): number =>
  [...text].reduce(
    (hash, character) =>
      Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );

/** One mulberry32 step, written without the usual mutable generator state */
const firstDraw = (seed: number): number => {
  const a = (seed + 0x9e3779b9) >>> 0;
  const b = Math.imul(a ^ (a >>> 15), 1 | a);
  const c = (b + Math.imul(b ^ (b >>> 7), 61 | b)) >>> 0;
  return ((c ^ (c >>> 14)) >>> 0) / 4294967296;
};

const move = (playerId: ChessPlayerId, san: string): ChessCommand => ({
  type: "MOVE",
  playerId,
  san,
});

/**
 * Mate in one, else the richest capture that no enemy pawn answers, else the
 * richest capture there is, else a move the FEN alone decides. It throws once
 * the game is over: the seat driver only asks the side `whoMustAct` names, so
 * a call here after the end is a caller bug and should be loud.
 */
export function chessHeuristic(
  state: ChessState,
  playerId: ChessPlayerId,
): ChessCommand {
  if (state.gameOver) {
    throw new Error(
      "Chess heuristic was asked for a move after the game ended",
    );
  }
  const mover = sideToMove(state);
  if (mover !== playerId) {
    throw new Error(
      `Chess heuristic was asked for ${playerId}, but it is ${mover} to move`,
    );
  }

  const moves = new Chess(state.fen).moves({ verbose: true });
  const fallback = moves[0];
  if (fallback === undefined) {
    throw new Error("Chess heuristic found no legal move in a live game");
  }

  const mate = moves.find(candidate => isMate(state.fen, candidate.san));
  if (mate) return move(playerId, mate.san);

  const captures = moves.filter(candidate => candidate.captured !== undefined);
  const safe = captures.filter(
    candidate => !takenByAPawn(state.fen, candidate),
  );
  const best = run(() => {
    const pool = safe.length > 0 ? safe : captures;
    const head = pool[0];
    return head === undefined ? undefined : pool.reduce(richer, head);
  });
  if (best) return move(playerId, best.san);

  const index = Math.floor(firstDraw(hashOf(state.fen)) * moves.length);
  return move(playerId, (moves[index] ?? fallback).san);
}
