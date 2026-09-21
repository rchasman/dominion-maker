import {
  experimental_evaluate,
  gateway,
  type Experimental_EvaluationQuestion,
} from "ai";
import {
  JEV_QUESTION_ID,
  jevQuestions,
  readJevChoice,
  readTypesafeConfidence,
  type JevChoiceQuestion,
  type JsonObject,
} from "./jev-protocol";

/**
 * One Jev vote on one game state: the choice question plus any companion
 * questions, evaluated in the same call. Every game that offers Jev a move
 * goes through here, so the request shape lives once.
 */
export async function askJevChoice<
  M,
  EXTRA extends Record<string, Experimental_EvaluationQuestion>,
>(params: {
  modelId: string;
  state: JsonObject;
  question: JevChoiceQuestion<M>;
  extraQuestions: EXTRA;
  abortSignal?: AbortSignal | undefined;
}) {
  const { modelId, state, question, extraQuestions, abortSignal } = params;
  // Jev's rate limits move with demand; a 429 should not fail the vote outright
  const { answers, providerMetadata, usage } = await experimental_evaluate({
    model: gateway.evaluationModel(modelId),
    state,
    questions: jevQuestions(question, extraQuestions),
    maxRetries: 2,
    ...(abortSignal ? { abortSignal } : {}),
  });
  const answer = answers[JEV_QUESTION_ID];
  return {
    ...readJevChoice(answer, question.options),
    answer,
    answers,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
    confidence: readTypesafeConfidence(providerMetadata),
  };
}
