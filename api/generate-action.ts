import { actionRequestSchema, readRequest } from "./_request";
import { GAMES } from "./_games";
import {
  generateObject,
  gateway,
  wrapLanguageModel,
  NoObjectGeneratedError,
} from "ai";
import type { ModelMessage } from "ai";
import type { VercelRequest, VercelResponse } from "./_http";
import type { GameState } from "../src/types/game-state";
import {
  choiceSchema,
  choiceToMove,
  replyFormatInstruction,
} from "../src/core/consensus/numbered-choice";
import { withReasoning } from "../src/dominion/moves";
import { MODELS, type ModelConfig } from "../src/config/models";
import { apiLogger } from "../src/lib/logger";
import { env } from "../src/lib/env";
import { promptJsonMiddleware } from "../src/agent/model-output";

// HTTP Status Codes
const HTTP_BAD_REQUEST = 400;
const HTTP_OK = 200;
const HTTP_INTERNAL_ERROR = 500;

// Error message display limits
const ERROR_TEXT_PREVIEW_LONG = 500;
const ERROR_TEXT_PREVIEW_SHORT = 200;

// Debug logging for deployment
if (!env.AI_GATEWAY_API_KEY) {
  apiLogger.error("AI_GATEWAY_API_KEY is not set");
} else {
  apiLogger.info("AI_GATEWAY_API_KEY is configured");
}

interface RequestBody {
  game: keyof typeof GAMES;
  provider: string;
  currentState: GameState;
  playerStrategies?: Record<string, unknown> | undefined;
  customStrategy?: string | undefined;
}

// Process request body and validate input
async function processGenerationRequest(
  body: RequestBody,
  res: VercelResponse,
): Promise<VercelResponse> {
  const { provider, currentState } = body;
  const { game } = GAMES[body.game];
  const playerStrategies = body.playerStrategies ?? {};
  const customStrategy = body.customStrategy ?? "";

  // Derived server-side so the numbering can never disagree with the state
  const player = game.whoMustAct(currentState);
  if (player === null) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "Nobody has to act in the current state" });
  }
  const legalActions = game.legalMoves(currentState, player);
  if (legalActions.length === 0) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "No legal actions for the current state" });
  }

  const config: ModelConfig | undefined = MODELS.find(m => m.id === provider);
  if (!config) {
    return res.status(HTTP_BAD_REQUEST).json({ error: "Invalid provider" });
  }

  const promptInput = {
    state: currentState,
    player,
    moves: legalActions,
    playerStrategies,
    customStrategy,
  };

  if (config.evaluation) {
    if (!game.evaluate) {
      return res
        .status(HTTP_BAD_REQUEST)
        .json({ error: "This game has no evaluation model" });
    }
    const { move, distribution } = await game.evaluate({
      ...promptInput,
      modelId: config.fullName,
    });
    return res.status(HTTP_OK).json({ move, distribution });
  }

  const baseModel = gateway(config.fullName);
  const model =
    config.structuredOutput === "prompt"
      ? wrapLanguageModel({
          model: baseModel,
          middleware: [promptJsonMiddleware],
        })
      : baseModel;

  const { system: systemPrompt, user: userMessage } = game.prompt(promptInput);

  // No text repair by design — invalid replies get one corrective retry and
  // habitual misformatters surface as warns (roster live-verified 2026-09)
  const schema = choiceSchema(legalActions.length);
  const attempt = async (messages: ModelMessage[]) => {
    const { object } = await generateObject({
      model,
      instructions: systemPrompt,
      messages,
      schema,
      maxRetries: 0,
      providerOptions: {
        gateway: {
          ...(config.gatewayProviders
            ? { only: [...config.gatewayProviders] }
            : {}),
          // Actions are short: prioritize time to first token.
          sort: "ttft",
        },
      },
    });
    return choiceToMove(object, legalActions, withReasoning);
  };

  const generationFailed = (error: Error) => {
    apiLogger.error(`${provider} generation failed: ${error.message}`);
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Generation failed",
      provider,
      message: error.message,
    });
  };

  try {
    const move = await attempt([{ role: "user", content: userMessage }]);
    return res.status(HTTP_OK).json({ move });
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err)) {
      return generationFailed(err as Error);
    }

    const reason = (
      (err.cause as Error | undefined)?.message ?? err.message
    ).slice(0, ERROR_TEXT_PREVIEW_SHORT);
    apiLogger.warn(
      `${provider} invalid reply (${reason}), retrying — raw: ${err.text?.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
    );

    try {
      const move = await attempt([
        { role: "user", content: userMessage },
        { role: "assistant", content: err.text ?? "" },
        {
          role: "user",
          content: `Your previous reply was invalid: ${reason}. ${replyFormatInstruction(legalActions.length)}`,
        },
      ]);
      return res.status(HTTP_OK).json({ move });
    } catch (retryErr) {
      if (!NoObjectGeneratedError.isInstance(retryErr)) {
        return generationFailed(retryErr as Error);
      }

      apiLogger.error(
        `${provider} invalid reply after retry — raw: ${retryErr.text?.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
      );
      return res.status(HTTP_INTERNAL_ERROR).json({
        error: "Model reply did not select a legal action",
        provider,
        rawText: retryErr.text?.slice(0, ERROR_TEXT_PREVIEW_SHORT) ?? "",
      });
    }
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const body = await readRequest(req, res, actionRequestSchema);
  if (!body) return res;

  try {
    return await processGenerationRequest(body, res);
  } catch (err) {
    const provider = body.provider;

    // Log and return error
    const error = err as Error;
    apiLogger.error(`${provider} failed: ${error.message}`);

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: HTTP_INTERNAL_ERROR,
      message: `Model failed: ${error.message}`,
    });
  }
}

// Bun runtime configured globally in vercel.json via bunVersion
