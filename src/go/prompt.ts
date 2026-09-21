import type { PromptInput } from "../core/game-definition";
import {
  formatNumberedMoves,
  replyFormatInstruction,
  replyShape,
} from "../core/consensus/numbered-choice";
import { KOMI, columnLabels, recordLabel, stoneName, stoneOf } from "./rules";
import type { GoMove, GoShape, GoState } from "./shape";

const RECALLED_MOVES = 8;

/** One row of the numbered table; the label already names the point */
export const goPromptRow = (move: GoMove) => ({ point: move.label });

/** The ASCII board reads stones as X and O, the way printed problems do */
const GLYPHS: Record<string, string> = { B: "X", W: "O" };

const GUIDANCE = `GUIDANCE:
- Open in the corners, then the sides, then the centre: corners need the fewest stones to hold.
- Play on the third and fourth lines early. The first and second lines give territory away.
- Keep your groups connected and give each one two eyes. A group with one liberty is in atari and about to be captured.
- Capture stones that cannot escape, and do not chase stones that can.
- Pass only when every remaining move loses points. Filling your own eyes loses the group.`;

/**
 * The reply rules live in the system text, matching Dominion, because the
 * models were live-verified against prose plus response_format rather than
 * response_format alone.
 */
function systemPrompt(choiceCount: number): string {
  return `You are playing Go (weiqi, baduk) against one opponent, under area scoring with positional superko. Points are written as a column letter and a row number, "D4"; the letters skip I and row 1 is the bottom edge.

The user message gives you the board as ASCII (X is Black, O is White, . is empty), the stones each side has captured, the komi, the moves played recently, and LEGAL MOVES: a numbered table of every move you may play right now, the pass included. Pick exactly one entry by its number. Never invent a move that is not in the table.

OUTPUT FORMAT: reply with ONLY this JSON object, no other text and no markdown fences. Write your reasoning FIRST, then the choice. Give the decisive point of the move in 1-2 sentences:
${replyShape("<number from LEGAL MOVES>")}

${replyFormatInstruction(choiceCount)}

${GUIDANCE}`;
}

function asciiBoard(board: string, size: number): string {
  const header = `   ${columnLabels(size).join(" ")}`;
  const rows = Array.from({ length: size }, (_, y) => {
    const stones = board
      .slice(y * size, (y + 1) * size)
      .split("")
      .map(stone => GLYPHS[stone] ?? stone)
      .join(" ");
    return `${String(size - y).padStart(2)} ${stones}`;
  });
  return [header, ...rows].join("\n");
}

const capturesLine = (state: GoState): string =>
  `CAPTURES: Black has taken ${state.captures[0]}, White has taken ${state.captures[1]}. KOMI: ${KOMI} to White.`;

export function goPrompt({
  state,
  player,
  moves,
  customStrategy,
}: PromptInput<GoShape>): { system: string; user: string } {
  const colour = stoneName(stoneOf(state.moves.length));
  const recent = state.moves
    .slice(-RECALLED_MOVES)
    .map(move => recordLabel(state.size, move));
  const strategy = customStrategy.trim();

  const sections = [
    `YOU ARE: ${player}, playing ${colour}. It is your move.`,
    `BOARD (${state.size}x${state.size}):\n${asciiBoard(state.board, state.size)}`,
    capturesLine(state),
    ...(recent.length > 0 ? [`RECENT MOVES: ${recent.join(" ")}`] : []),
    ...(strategy.length > 0 ? [`STRATEGY OVERRIDE:\n${strategy}`] : []),
    `LEGAL MOVES (choose exactly one by number):\n${formatNumberedMoves(moves, goPromptRow)}`,
  ];

  return {
    system: systemPrompt(moves.length),
    user: sections.join("\n\n"),
  };
}
