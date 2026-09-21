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
import {
  describePass,
  describeScore,
  factsOf,
  positionFacts,
  type PlacementFacts,
} from "./candidates";
import { RECALLED_MOVES } from "./prompt";
import {
  boardHeader,
  boardRows,
  isSelfAtari,
  KOMI,
  opponentOf,
  recordLabel,
  stoneName,
  stoneOf,
  type Stone,
} from "./rules";
import type { GoMove, GoShape, GoState } from "./shape";

// Go's side of the Jev protocol. Jev cannot count liberties or captures off
// a board string, so every option states what the rules prove the stone
// does, and the state names the score the board would settle at right now.

const BOARD_KEY =
  "Each row starts with its row number; row 1 is the bottom edge. Columns run left to right under the letters in `columns`. B is a Black stone, W a White stone and a dot an empty point.";

/** One liberty reads two ways: a self-atari hands the stone over, while a capture that leaves one liberty is a ko or a snapback and superko holds the retake back a move */
const libertiesSentence = (facts: PlacementFacts): string => {
  if (isSelfAtari(facts))
    return "The group it joins would have 1 liberty: in atari, capturable on the next move";
  if (facts.libertiesAfter === 1)
    return "The group it joins would have 1 liberty after capturing: a ko or snapback, a ko cannot be retaken at once";
  return `The group it joins would have ${facts.libertiesAfter} liberties`;
};

const describePlacement = (
  stone: Stone,
  label: string,
  facts: PlacementFacts,
): string => {
  const enemy = stoneName(opponentOf(stone));
  const sentences = [
    `${stoneName(stone)} stone at ${label}, on line ${facts.line}`,
    facts.captures > 0
      ? `Captures ${plural(facts.captures, `${enemy} stone`)}`
      : "Captures nothing",
    libertiesSentence(facts),
    ...(facts.rescues > 0
      ? [`Saves ${plural(facts.rescues, "own stone")} from atari`]
      : []),
    ...(facts.atari > 0
      ? [`Puts ${plural(facts.atari, `${enemy} stone`)} in atari`]
      : []),
    ...(facts.exposed > 0
      ? [
          `Leaves ${plural(facts.exposed, "own stone")} the opponent can capture with its next stone`,
        ]
      : []),
    ...(facts.threatened > 0
      ? [
          `Leaves an own group of ${plural(facts.threatened, "stone")} the opponent can put in atari with a stone that is not itself in atari`,
        ]
      : []),
    `Touches ${plural(facts.touchesOwn, "own stone")} and ${plural(facts.touchesEnemy, "enemy stone")}`,
  ];
  return sentences.join(". ");
};

const passOption = (state: GoState): string =>
  `Pass: plays no stone. It ${describePass(state)}`;

const cutNotice = (offered: number): string =>
  ` Only the ${offered} strongest candidate moves are listed: every capture and rescue, then the placements that leave the fewest own stones open to capture, then the inner lines; the rest were left out as the weakest by these facts.`;

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
  return factsOf(state, moves).map(({ move, facts }, index) => ({
    index,
    facts,
    option: {
      key: jevOptionKey(index, move.label),
      description:
        facts === null
          ? passOption(state)
          : describePlacement(stone, move.label, facts),
      move,
    },
  }));
};

type JudgedPlacement = Judged & { facts: PlacementFacts };

const isPlacement = (entry: Judged): entry is JudgedPlacement =>
  entry.facts !== null;

/** Captures first, then rescues, then the fewest own stones left open to capture, then the inner lines; a tie keeps board order */
const byStrength = (a: JudgedPlacement, b: JudgedPlacement): number =>
  b.facts.captures - a.facts.captures ||
  b.facts.rescues - a.facts.rescues ||
  a.facts.exposed - b.facts.exposed ||
  b.facts.line - a.facts.line ||
  a.index - b.index;

const byIndex = (a: Judged, b: Judged): number => a.index - b.index;

/**
 * The pass and the strongest placements that fit under the gateway's option
 * limit, back in board order. The keys keep their place in the full move
 * list, so the answer maps onto the move that was judged.
 */
const strongestJudged = (judged: Judged[]): Judged[] => {
  const passes = judged.filter(entry => entry.facts === null);
  const placements = judged.filter(isPlacement);
  const room = JEV_MAX_OPTIONS - passes.length;
  return [...passes, ...[...placements].sort(byStrength).slice(0, room)].sort(
    byIndex,
  );
};

/** One option per offered move, keyed by its number in the table, cut to the strongest when the list exceeds the gateway's limit */
export function goJevQuestion(
  state: GoState,
  moves: GoMove[],
): JevChoiceQuestion<GoMove> {
  const judged = judgeMoves(state, moves);
  const offered =
    judged.length > JEV_MAX_OPTIONS ? strongestJudged(judged) : judged;
  const cut = offered.length < judged.length ? cutNotice(offered.length) : "";
  return {
    instructions: instructions(stoneName(stoneOf(state.moves.length)), cut),
    options: offered.map(entry => entry.option),
  };
}

export function goJevState(state: GoState, customStrategy: string): JsonObject {
  const { score, territory, groups, threats } = positionFacts(state);
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
    emptyPoints: {
      blackTerritory: territory.black,
      whiteTerritory: territory.white,
      neutral: territory.neutral,
    },
    groups: groups.map(group => ({
      colour: stoneName(group.stone),
      stones: group.stones,
      around: group.around,
      liberties: group.liberties,
      inAtari: group.liberties === 1,
    })),
    threatsNow: {
      stonesTheOpponentCanCapture: threats.exposed,
      largestGroupTheOpponentCanPutInAtariWithoutSelfAtari: threats.threatened,
    },
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
