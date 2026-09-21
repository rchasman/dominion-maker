import {
  actionRequestSchema,
  readRequest,
  type ActionRequest,
} from "./_request";
import { chessModule } from "../src/chess/module";
import { dominionModule } from "../src/dominion/module";
import { goModule } from "../src/go/module";
import type { GameShape } from "../src/core/game-definition";
import type { GameModule } from "../src/core/game-module";
import {
  generateObject,
  gateway,
  wrapLanguageModel,
  NoObjectGeneratedError,
} from "ai";
import type { ModelMessage } from "ai";
import type { VercelRequest, VercelResponse } from "./_http";
import {
  choiceSchema,
  choiceToMove,
  replyFormatInstruction,
} from "../src/core/consensus/numbered-choice";
import { MODELS, type ModelConfig } from "../src/config/models";
import { addUsage, type TokenUsage } from "../src/core/consensus/cost";
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

const tokenUsage = (
  usage:
    | { inputTokens?: number | undefined; outputTokens?: number | undefined }
    | undefined,
): TokenUsage => ({
  inputTokens: usage?.inputTokens ?? 0,
  outputTokens: usage?.outputTokens ?? 0,
});

// Debug logging for deployment
if (!env.AI_GATEWAY_API_KEY) {
  apiLogger.error("AI_GATEWAY_API_KEY is not set");
} else {
  apiLogger.info("AI_GATEWAY_API_KEY is configured");
}

/**
 * One arm of the request union at a time: the module and the state it parsed
 * have to reach the definition as one correlated pair, so the game is picked
 * here and everything below it is generic.
 */
function processGenerationRequest(
  body: ActionRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  switch (body.game) {
    case "dominion":
      return generateForGame(dominionModule, body.currentState, body, res);
    case "chess":
      return generateForGame(chessModule, body.currentState, body, res);
    case "go":
      return generateForGame(goModule, body.currentState, body, res);
  }
}

// Process request body and validate input
async function generateForGame<G extends GameShape>(
  module: GameModule<G>,
  currentState: G["state"],
  body: ActionRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const { provider } = body;
  const game = module.definition;
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
    const { move, distribution, usage } = await game.evaluate({
      ...promptInput,
      modelId: config.fullName,
    });
    return res.status(HTTP_OK).json({ move, distribution, usage });
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
    const { object, usage } = await generateObject({
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
    return {
      move: choiceToMove(object, legalActions, (move, reasoning) =>
        game.withReasoning(move, reasoning),
      ),
      usage: tokenUsage(usage),
    };
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
    const { move, usage } = await attempt([
      { role: "user", content: userMessage },
    ]);
    return res.status(HTTP_OK).json({ move, usage });
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
      const retry = await attempt([
        { role: "user", content: userMessage },
        { role: "assistant", content: err.text ?? "" },
        {
          role: "user",
          content: `Your previous reply was invalid: ${reason}. ${replyFormatInstruction(legalActions.length)}`,
        },
      ]);
      // The rejected attempt was billed too, so both are reported
      return res.status(HTTP_OK).json({
        move: retry.move,
        usage: addUsage(tokenUsage(err.usage), retry.usage),
      });
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
