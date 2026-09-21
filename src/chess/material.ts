import type { Chess } from "chess.js";
import { plural } from "../lib/plural";

/** Material worth of each piece; the king is never captured, so it has none */
export const PIECE_VALUES: Record<string, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
};

type Material = { white: number; black: number };

/** Each side's material on the board, in pawns */
export const materialOf = (board: Chess): Material =>
  board
    .board()
    .flat()
    .reduce<Material>(
      (tally, cell) => {
        if (cell === null) return tally;
        const value = PIECE_VALUES[cell.type] ?? 0;
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
