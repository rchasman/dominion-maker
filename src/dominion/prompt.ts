import type { EvaluateInput, PromptInput } from "../core/game-definition";
import type { DominionShape } from "./shape";
import { buildSystemPrompt } from "../agent/system-prompt";
import { buildUserMessage } from "../agent/action-prompt";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "../agent/strategic-context";
import { askJev } from "../agent/jev-choice";

/** The strategy record travels as the JSON string the prompt always carried */
const summarize = (playerStrategies: Record<string, unknown>): string =>
  JSON.stringify(playerStrategies);

export function dominionPrompt({
  state,
  moves,
  playerStrategies,
  customStrategy,
}: PromptInput<DominionShape>): { system: string; user: string } {
  return {
    system: buildSystemPrompt(state.supply),
    user: buildUserMessage({
      strategicContext: buildStrategicContext(
        state,
        summarize(playerStrategies),
        customStrategy,
      ),
      currentState: state,
      recentTurnsStr: formatTurnHistoryForAnalysis(state),
      legalActions: moves,
    }),
  };
}

export async function dominionEvaluate({
  modelId,
  state,
  moves,
  playerStrategies,
  customStrategy,
}: EvaluateInput<DominionShape>) {
  const { action, distribution, usage } = await askJev({
    modelId,
    currentState: state,
    legalActions: moves,
    strategySummary: summarize(playerStrategies),
    customStrategy,
  });
  return { move: action, distribution, usage };
}
