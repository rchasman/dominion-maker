import { verifyRequestSchema, readRequest } from "./_request";
import type { VercelRequest, VercelResponse } from "./_http";
import { MODELS, type ModelConfig } from "../src/config/models";
import { getLegalActions } from "../src/agent/legal-actions";
import { verifyWithJev } from "../src/agent/jev-choice";
import { apiLogger } from "../src/lib/logger";
import type { Action } from "../src/types/action";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

/** Both sides are narrowed so each variant compares its own fields */
const sameMove = (legal: Action, proposed: Action): boolean =>
  proposed.type === "choose_from_options"
    ? legal.type === "choose_from_options" &&
      legal.optionIndex === proposed.optionIndex
    : legal.type === proposed.type &&
      (legal.card ?? null) === (proposed.card ?? null);

// Second opinion on a consensus winner from the evaluation model. The action
// must be legal in the state so the server can type it from its own list.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const body = await readRequest(req, res, verifyRequestSchema);
  if (!body) return res;
  const configs: readonly ModelConfig[] = MODELS;
  const verifier = configs.find(m => m.evaluation);
  if (!verifier) {
    return res
      .status(HTTP_INTERNAL_ERROR)
      .json({ error: "No evaluation model configured" });
  }
  const proposed = body.action;
  const action = getLegalActions(body.currentState).find(legal =>
    sameMove(legal, proposed),
  );
  if (!action) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "Action is not legal in the given state" });
  }
  try {
    const verdict = await verifyWithJev({
      modelId: verifier.fullName,
      currentState: body.currentState,
      action,
      customStrategy: body.customStrategy,
    });
    return res.status(HTTP_OK).json(verdict);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    apiLogger.error(`verify-action failed: ${error.message}`);
    return res
      .status(HTTP_INTERNAL_ERROR)
      .json({ error: "Verification failed", message: error.message });
  }
}
