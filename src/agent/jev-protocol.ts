import type { Experimental_EvaluationQuestion, JSONValue } from "ai";
import { z } from "zod";
import type { WeightedVote } from "../core/consensus/types";

// The shape of one Jev choice, whatever the game: the numbered options it is
// offered and the way its answer maps back onto a move. Jev (TypeSafe's
// System One model) answers a typed Choice question instead of writing JSON
// with reasoning, so there is no text parsing and no retry. It reads JSON,
// not TOON, and loses accuracy on indirection, so a state is plain objects
// with named fields and each option carries the facts that matter for it.

export type JsonObject = { [key: string]: JSONValue };

/** One offered option: the key Jev answers with, the facts it judges by and the move the key maps back to */
export type JevOption<M> = {
  key: string;
  description: string | null;
  move: M;
};

export type JevChoiceQuestion<M> = {
  instructions: string;
  options: JevOption<M>[];
};

export type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
};

export const JEV_QUESTION_ID = "action";
/** The gateway rejects a Choice question with more options than this */
export const JEV_MAX_OPTIONS = 255;
/** Below this an option is noise in the tally and the voting pane */
const MIN_VOTE_WEIGHT = 0.01;

/** `${n}. ${label}`: the number keeps duplicate labels apart and maps the answer back */
export const jevOptionKey = (index: number, label: string): string =>
  `${index + 1}. ${label}`;

/** The questions object one evaluation call sends: the choice first, then any companions */
export function jevQuestions<
  M,
  EXTRA extends Record<string, Experimental_EvaluationQuestion>,
>(question: JevChoiceQuestion<M>, extraQuestions: EXTRA) {
  return {
    [JEV_QUESTION_ID]: {
      type: "choice" as const,
      instructions: question.instructions,
      criteria: Object.fromEntries(
        question.options.map(option => [option.key, option.description]),
      ),
    },
    ...extraQuestions,
  };
}

const PERCENT = 100;
export const formatPercent = (probability: number): string =>
  `${Math.round(probability * PERCENT)}%`;

function summariseDistribution(
  choice: string,
  probabilities: Record<string, number> | undefined,
): string {
  if (!probabilities) return "Jev picked this option.";
  const chosen = probabilities[choice];
  const runnerUp = Object.entries(probabilities)
    .filter(([key]) => key !== choice)
    .sort(([, a], [, b]) => b - a)[0];
  const lead =
    chosen === undefined
      ? "Jev picked this option."
      : `Jev picked this with ${formatPercent(chosen)} probability.`;
  if (!runnerUp) return lead;
  const [runnerUpKey, runnerUpProbability] = runnerUp;
  const runnerUpLabel = runnerUpKey.replace(/^\d+\. /, "");
  return `${lead} Runner-up: ${runnerUpLabel} (${formatPercent(runnerUpProbability)}).`;
}

function pickedOption<M>(
  answer: JevChoiceAnswer,
  options: JevOption<M>[],
): JevOption<M> {
  const picked = options.find(option => option.key === answer.choice);
  if (!picked) {
    throw new Error(`choice "${answer.choice}" is not an offered option`);
  }
  return picked;
}

/** Jev's whole distribution as weighted votes, so the tally can use the mass and not just the argmax */
function distributionOf<M>(
  answer: JevChoiceAnswer,
  options: JevOption<M>[],
): WeightedVote<M>[] {
  if (!answer.probabilities) {
    return [{ move: pickedOption(answer, options).move, weight: 1 }];
  }
  return Object.entries(answer.probabilities)
    .filter(([, weight]) => weight >= MIN_VOTE_WEIGHT)
    .flatMap(([key, weight]) => {
      const option = options.find(candidate => candidate.key === key);
      return option ? [{ move: option.move, weight }] : [];
    });
}

type JevChoiceRead<M> = {
  move: M;
  /** One line on the pick and its runner-up, in the voter's own words */
  reasoning: string;
  distribution: WeightedVote<M>[];
};

/** The answer mapped back onto the offered moves; throws when Jev names an option it was not offered */
export function readJevChoice<M>(
  answer: JevChoiceAnswer,
  options: JevOption<M>[],
): JevChoiceRead<M> {
  return {
    move: pickedOption(answer, options).move,
    reasoning: summariseDistribution(answer.choice, answer.probabilities),
    distribution: distributionOf(answer, options),
  };
}

const typesafeMetadataSchema = z.object({
  typesafe: z.object({ confidence: z.record(z.string(), z.number()) }),
});

/** TypeSafe's distribution-concentration statistic for the choice, 0-1, when the provider sent one */
export function readTypesafeConfidence(metadata: unknown): number | undefined {
  const parsed = typesafeMetadataSchema.safeParse(metadata);
  return parsed.success
    ? parsed.data.typesafe.confidence[JEV_QUESTION_ID]
    : undefined;
}
