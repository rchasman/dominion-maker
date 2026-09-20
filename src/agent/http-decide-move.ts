import type { DecideMove } from "../core/llm-controller";
import type { LLMLogger } from "../core/consensus/types";
import type { DominionShape } from "../dominion/definition";
import { createApiClient } from "../api/client";
import { agentLogger } from "../lib/logger";

const PERCENT = 100;

/** Ask the generate-action endpoint for one model's move */
export function httpDecideMove(baseUrl = ""): DecideMove<DominionShape> {
  const client = createApiClient(baseUrl);
  return async ({
    provider,
    state,
    playerStrategies,
    customStrategy,
    signal,
  }) => {
    const { data, error } = await client.api["generate-action"].post(
      {
        game: "dominion",
        provider,
        currentState: state,
        playerStrategies,
        customStrategy,
      },
      { fetch: { signal } },
    );
    if (error) throw new Error(error.value);
    if (!data?.move) throw new Error("Backend returned no move");
    return { move: data.move, distribution: data.distribution ?? [] };
  };
}

/**
 * Ask the evaluation model for a second opinion on the winner. Fire and
 * forget: the verdict is logged against the decision's actionId and never
 * delays execution.
 */
export function httpVerifyMove(baseUrl: string, logger: LLMLogger) {
  const client = createApiClient(baseUrl);
  return (
    state: DominionShape["state"],
    move: DominionShape["move"],
    actionId: string,
    customStrategy: string,
  ): void => {
    void client.api["verify-action"]
      .post({ currentState: state, action: move, customStrategy })
      .then(({ data, error }) => {
        if (error || !data || typeof data.blunder !== "number") {
          agentLogger.warn(
            `verify-action skipped: ${error?.value ?? "no verdict"}`,
          );
          return;
        }
        logger({
          type: "consensus-verdict",
          message: `Jev check: blunder risk ${Math.round(data.blunder * PERCENT)}%`,
          data: {
            actionId,
            blunder: data.blunder,
            ...(data.followsOverride !== undefined && {
              followsOverride: data.followsOverride,
            }),
          },
        });
      });
  };
}
