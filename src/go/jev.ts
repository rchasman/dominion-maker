import { askJevChoice } from "../agent/jev-evaluate";
import {
  JEV_MAX_OPTIONS,
  jevOptionKey,
  type JevChoiceQuestion,
  type JevOption,
  type JsonObject,
} from "../agent/jev-protocol";
import type { EvaluateInput } from "../core/game-definition";
import { plural } from "../lib/plural";
import { RECALLED_MOVES } from "./prompt";
import {
  boardHeader,
  boardRows,
  finalScore,
  groupAt,
  judgePlacement,
  KOMI,
  leaderOf,
  neighbourStones,
  opponentOf,
  recordLabel,
  replayMoves,
  rescuedStones,
  stoneName,
  stoneOf,
  type Point,
  type Placement,
  type Stone,
} from "./rules";
import type { GoMove, GoScore, GoShape, GoState } from "./shape";

// Go's side of the Jev protocol. Jev cannot count liberties or captures off
// a board string, so every option states what the rules prove the stone
// does, and the state names the score the board would settle at right now.

const BOARD_KEY =
  "Each row starts with its row number; row 1 is the bottom edge. Columns run left to right under the letters in `columns`. B is a Black stone, W a White stone and a dot an empty point.";

/** Lines are counted in from the nearest edge, the way players read a board */
const lineOf = (size: number, point: Point): number =>
  Math.min(point.x, point.y, size - 1 - point.x, size - 1 - point.y) + 1;

const standingOf = (score: GoScore): string => {
  const leader = leaderOf(score);
  if (leader === null) return "the game is tied";
  const margin = Math.abs(score.black - score.white);
  return `${stoneName(leader === 0 ? "B" : "W")} leads by ${margin}`;
};

const describeScore = (score: GoScore): string =>
  `Black ${score.black} to White ${score.white} with komi counted: ${standingOf(score)}`;

/** What the rules prove about one placement; the description and the ranking both read from here */
type PlacementFacts = {
  line: number;
  captured: number;
  liberties: number;
  rescued: number;
  ownNeighbours: number;
  enemyNeighbours: number;
};

const placementFacts = (
  state: GoState,
  stone: Stone,
  point: Point,
  placement: Placement,
): PlacementFacts => {
  const { size, board } = state;
  return {
    line: lineOf(size, point),
    captured: placement.captured,
    liberties: groupAt(placement.board, size, point).liberties.length,
    rescued: rescuedStones(size, board, stone, { point, placement }),
    ownNeighbours: neighbourStones(size, board, point, stone),
    enemyNeighbours: neighbourStones(size, board, point, opponentOf(stone)),
  };
};

const describePlacement = (
  stone: Stone,
  label: string,
  facts: PlacementFacts,
): string => {
  const enemy = opponentOf(stone);
  const sentences = [
    `${stoneName(stone)} stone at ${label}, on line ${facts.line}`,
    facts.captured > 0
      ? `Captures ${plural(facts.captured, `${stoneName(enemy)} stone`)}`
      : "Captures nothing",
    facts.liberties === 1
      ? "The group it joins would have 1 liberty: in atari, capturable on the next move"
      : `The group it joins would have ${facts.liberties} liberties`,
    ...(facts.rescued > 0
      ? [`Saves ${plural(facts.rescued, "own stone")} from atari`]
      : []),
    `Touches ${plural(facts.ownNeighbours, "own stone")} and ${plural(facts.enemyNeighbours, "enemy stone")}`,
  ];
  return sentences.join(". ");
};

const describePass = (state: GoState): string => {
  const score = describeScore(finalScore(state.board, state.size));
  return state.consecutivePasses > 0
    ? `Pass: plays no stone. The opponent has just passed, so this ends the game and it is scored as it stands: ${score}`
    : `Pass: plays no stone. If the opponent passes next, the game ends and is scored as it stands: ${score}`;
};

const cutNotice = (offered: number, legal: number): string =>
  ` Only ${offered} of the ${legal} legal moves are offered: every capture and rescue, then the placements on the inner lines; the rest were left out as the weakest by these facts.`;

const instructions = (colour: string, cut: string): string =>
  `You are ${colour} and it is your move. Which move should you play now? Every option is a legal move and its description states what the stone does on the board; those facts are binding.${cut} Capture stones that cannot escape and save your own stones in atari. Keep your groups connected with two or more liberties and do not fill your own eyes. Early in the game play on line 3 or line 4 near a corner; a stone on line 1 or line 2 gives territory away, and the exact corner point is the weakest of all. Pass only when every stone would lose points. When \`strategyOverride\` is present, follow it. Pick the option that most improves ${colour}'s chance of winning this game of Go under area scoring.`;

/** An option with its place in the legal move list and, for a placement, the facts it is ranked by */
type Judged = {
  index: number;
  option: JevOption<GoMove>;
  facts: PlacementFacts | null;
};

const judgeMoves = (state: GoState, moves: GoMove[]): Judged[] => {
  const stone = stoneOf(state.moves.length);
  const { positions } = replayMoves(state.size, state.moves);
  return moves.map((move, index) => {
    const key = jevOptionKey(index, move.label);
    if (move.kind === "pass") {
      return {
        index,
        option: { key, description: describePass(state), move },
        facts: null,
      };
    }
    const judged = judgePlacement(
      state.size,
      state.board,
      positions,
      stone,
      move,
    );
    if (!judged.ok) throw new Error(`${move.label} is ${judged.error}`);
    const facts = placementFacts(state, stone, move, judged.placement);
    return {
      index,
      option: {
        key,
        description: describePlacement(stone, move.label, facts),
        move,
      },
      facts,
    };
  });
};

/** Captures first, then rescues, then the inner lines; a tie keeps board order */
const byStrength = (a: Judged, b: Judged): number => {
  const factsA = a.facts ?? { captured: 0, rescued: 0, line: 0 };
  const factsB = b.facts ?? { captured: 0, rescued: 0, line: 0 };
  return (
    factsB.captured - factsA.captured ||
    factsB.rescued - factsA.rescued ||
    factsB.line - factsA.line ||
    a.index - b.index
  );
};

const byIndex = (a: Judged, b: Judged): number => a.index - b.index;

/**
 * The pass and the strongest placements that fit under the gateway's option
 * limit, back in board order. The keys keep their place in the full move
 * list, so the answer maps onto the move that was judged.
 */
const strongestJudged = (judged: Judged[]): Judged[] => {
  const passes = judged.filter(entry => entry.facts === null);
  const placements = judged.filter(entry => entry.facts !== null);
  const room = JEV_MAX_OPTIONS - passes.length;
  return [...passes, ...[...placements].sort(byStrength).slice(0, room)].sort(
    byIndex,
  );
};

/** One option per legal move, keyed by its number in the table, cut to the strongest when the list exceeds the gateway's limit */
export function goJevQuestion(
  state: GoState,
  moves: GoMove[],
): JevChoiceQuestion<GoMove> {
  const judged = judgeMoves(state, moves);
  const offered =
    judged.length > JEV_MAX_OPTIONS ? strongestJudged(judged) : judged;
  const cut =
    offered.length < judged.length
      ? cutNotice(offered.length, judged.length)
      : "";
  return {
    instructions: instructions(stoneName(stoneOf(state.moves.length)), cut),
    options: offered.map(entry => entry.option),
  };
}

export function goJevState(state: GoState, customStrategy: string): JsonObject {
  const score = finalScore(state.board, state.size);
  const recentMoves = state.moves
    .slice(-RECALLED_MOVES)
    .map(move => recordLabel(state.size, move));
  const strategy = customStrategy.trim();
  return {
    game: "go",
    size: state.size,
    sideToMove: stoneName(stoneOf(state.moves.length)),
    moveNumber: state.moves.length + 1,
    boardKey: BOARD_KEY,
    columns: boardHeader(state.size),
    board: boardRows(state.board, state.size, stone => stone),
    captures: { black: state.captures[0], white: state.captures[1] },
    komi: KOMI,
    consecutivePasses: state.consecutivePasses,
    scoreIfGameEndedNow: { ...score, summary: describeScore(score) },
    ...(recentMoves.length > 0 ? { recentMoves } : {}),
    ...(strategy.length > 0 ? { strategyOverride: strategy } : {}),
  };
}

export async function goEvaluate({
  modelId,
  state,
  moves,
  customStrategy,
}: EvaluateInput<GoShape>) {
  const vote = await askJevChoice({
    modelId,
    state: goJevState(state, customStrategy),
    question: goJevQuestion(state, moves),
    extraQuestions: {},
  });
  return {
    move: { ...vote.move, reasoning: vote.reasoning },
    distribution: vote.distribution,
    usage: vote.usage,
  };
}
