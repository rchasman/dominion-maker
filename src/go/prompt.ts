import type { PromptInput } from "../core/game-definition";
import {
  formatNumberedMoves,
  replyFormatInstruction,
  replyShape,
} from "../core/consensus/numbered-choice";
import { plural } from "../lib/plural";
import {
  FACT_COLUMNS,
  describePass,
  describeScore,
  factsOf,
  positionFacts,
  type GroupFacts,
  type JudgedMove,
} from "./candidates";
import {
  KOMI,
  boardHeader,
  boardRows,
  recordLabel,
  stoneName,
  stoneOf,
  type Stone,
} from "./rules";
import type { GoShape, GoState } from "./shape";

export const RECALLED_MOVES = 8;

/** The ASCII board reads stones as X and O, the way printed problems do */
const GLYPHS: Record<string, string> = { B: "X", W: "O" };

/** A pass places no stone, so its fact columns carry this in place of a count */
const NO_STONE = "n/a";

const GUIDANCE = `GUIDANCE (read the fact columns, not the picture):
- captures and rescues come first. A move that captures stones or saves your own stones from atari is worth those stones at once; take the biggest on offer.
- libertiesAfter is what your group breathes once the stone lands. 1 with captures 0 is self-atari: the opponent captures it next move. 1 after a capture is a ko or snapback, and a ko cannot be retaken at once. A stone with touchesOwn 0 starts a new group.
- atari counts enemy stones your move leaves with one liberty; the opponent must answer or lose them.
- exposed and threatened read the board after your stone lands: exposed is the most of your own stones one legal opponent reply could capture, and 0 means no stone of yours can be captured next move. threatened is the size of the largest group of yours one legal reply could put in atari with a stone that is not itself in atari.
- line is counted from the nearest edge. Lines 3 and 4 make territory; line 1 makes none and line 2 little. Go to lines 1 and 2 only to capture, rescue or connect.
- Under area scoring every neutral point you fill is a point for you, so fill the neutral points before you pass. The pass is in the table only when every remaining stone is self-atari or fills your own eye, when no neutral point remains, or when you lead and the opponent just passed. When it is there, pass rather than hand over a group; the pass row states the score the game would end at.`;

/**
 * The reply rules live in the system text, matching Dominion, because the
 * models were live-verified against prose plus response_format rather than
 * response_format alone.
 */
function systemPrompt(choiceCount: number): string {
  return `You are playing Go (weiqi, baduk) against one opponent, under area scoring with positional superko. Points are written as a column letter and a row number, "D4"; the letters skip I and row 1 is the bottom edge.

The user message gives you the board as ASCII (X is Black, O is White, . is empty), then facts the rules computed: the score if the game ended now, how many empty points are each side's territory or neutral, the captures and komi, every group on the board with its liberties, what the opponent's next stone could capture or put in atari if you did nothing about it, and the moves played recently. LEGAL MOVES is a numbered table of the moves you may play right now. Each row states what the rules prove about that stone: line (counted from the nearest edge), captures (enemy stones it lifts), libertiesAfter (your group's liberties once it lands), rescues (own stones it saves from atari), atari (enemy stones it leaves with one liberty), touchesOwn and touchesEnemy (neighbouring stones), exposed (own stones the opponent could capture with its next stone) and threatened (the largest own group the opponent could put in atari with a next stone that is not itself in atari). The pass is listed only when the rules allow it to make sense, and its row says what it does. Pick exactly one entry by its number. Never invent a move that is not in the table.

OUTPUT FORMAT: reply with ONLY this JSON object, no other text and no markdown fences. Write your reasoning FIRST, then the choice. Give the decisive point of the move in 1-2 sentences:
${replyShape("<number from LEGAL MOVES>")}

${replyFormatInstruction(choiceCount)}

${GUIDANCE}`;
}

const asciiBoard = (board: string, size: number): string =>
  [
    boardHeader(size),
    ...boardRows(board, size, stone => GLYPHS[stone] ?? stone),
  ].join("\n");

const noStoneFacts: Record<string, string> = Object.fromEntries(
  FACT_COLUMNS.map(column => [column, NO_STONE]),
);

/** One row of the numbered table: the point and the facts behind the stone; the pass states its effect instead */
const promptRow =
  (state: GoState) =>
  ({ move, facts }: JudgedMove): Record<string, string | number> =>
    facts === null
      ? { point: `pass: ${describePass(state)}`, ...noStoneFacts }
      : { point: move.label, ...facts };

const libertiesText = (count: number): string =>
  `${count} ${count === 1 ? "liberty" : "liberties"}`;

const groupText = (group: GroupFacts): string =>
  `${plural(group.stones, "stone")} around ${group.around}, ${libertiesText(group.liberties)}${group.liberties === 1 ? " (IN ATARI)" : ""}`;

const groupsLine = (stone: Stone, groups: GroupFacts[]): string => {
  const own = groups.filter(group => group.stone === stone).map(groupText);
  return `${stoneName(stone).toUpperCase()} GROUPS: ${own.length > 0 ? own.join("; ") : "none"}`;
};

const capturesLine = (state: GoState): string =>
  `CAPTURES: Black has taken ${state.captures[0]}, White has taken ${state.captures[1]}. KOMI: ${KOMI} to White.`;

/** The facts of the position as the rules count them, before any move is weighed */
const positionSection = (state: GoState): string => {
  const { score, territory, groups, threats } = positionFacts(state);
  return [
    `POSITION: if the game ended now, ${describeScore(score)}.`,
    `EMPTY POINTS: ${territory.black} Black territory, ${territory.white} White territory, ${territory.neutral} neutral (touching both colours, or neither).`,
    capturesLine(state),
    groupsLine("B", groups),
    groupsLine("W", groups),
    `THREATS NOW: stones the opponent can capture right now: ${threats.exposed}. Largest own group the opponent can put in atari right now with a stone that is not itself in atari: ${plural(threats.threatened, "stone")}.`,
  ].join("\n");
};

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
    positionSection(state),
    ...(recent.length > 0 ? [`RECENT MOVES: ${recent.join(" ")}`] : []),
    ...(strategy.length > 0 ? [`STRATEGY OVERRIDE:\n${strategy}`] : []),
    `LEGAL MOVES (choose exactly one by number; the columns are facts the rules prove):\n${formatNumberedMoves(factsOf(state, moves), promptRow(state))}`,
  ];

  return {
    system: systemPrompt(moves.length),
    user: sections.join("\n\n"),
  };
}
