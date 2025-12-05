import { generateObject, createGateway } from "ai";
import type { GameState } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import { Action as ActionSchema } from "../src/types/action";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP, type ModelProvider } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";

// Configure AI Gateway with server-side API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
});

// Generate a single action from a model - marked as a step for durability
async function generateActionFromModel(
  provider: ModelProvider,
  currentState: GameState,
  legalActions: Action[],
  humanChoice?: { selectedCards: string[] }
): Promise<Action> {
  "use step";

  const modelName = MODEL_MAP[provider];
  if (!modelName) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  const model = gateway(modelName);
  const isAnthropic = provider.startsWith("claude");

  const legalActionsStr = legalActions.length > 0
    ? `\n\nLEGAL ACTIONS (you MUST choose one of these):\n${JSON.stringify(legalActions, null, 2)}`
    : "";

  const turnHistoryStr = currentState.turnHistory?.length > 0
    ? `\n\nACTIONS TAKEN THIS TURN (so far):\n${JSON.stringify(currentState.turnHistory, null, 2)}`
    : "";

  const strategicContext = buildStrategicContext(currentState);

  let promptQuestion: string;
  if (currentState.pendingDecision) {
    const decision = currentState.pendingDecision;
    promptQuestion = `${decision.player.toUpperCase()} must respond to: ${decision.prompt}\nWhat action should ${decision.player} take?`;
  } else {
    promptQuestion = `What is the next atomic action for ${currentState.activePlayer}?`;
  }

  const userMessage = humanChoice
    ? `${strategicContext}\n\nCurrent state:\n${JSON.stringify(currentState, null, 2)}${turnHistoryStr}\n\nHuman chose: ${JSON.stringify(humanChoice.selectedCards)}${legalActionsStr}\n\n${promptQuestion}`
    : `${strategicContext}\n\nCurrent state:\n${JSON.stringify(currentState, null, 2)}${turnHistoryStr}${legalActionsStr}\n\n${promptQuestion}`;

  const result = await generateObject({
    model,
    schema: ActionSchema,
    system: DOMINION_SYSTEM_PROMPT,
    prompt: userMessage,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(15000),
    ...(isAnthropic && {
      providerOptions: {
        anthropic: {
          structuredOutputMode: "auto",
        },
      },
    }),
  });

  return result.object;
}

// Main workflow: generate action with a single model call
export async function generateActionWorkflow(
  provider: ModelProvider,
  currentState: GameState,
  legalActions: Action[],
  humanChoice?: { selectedCards: string[] }
): Promise<{ action: Action }> {
  "use workflow";

  const action = await generateActionFromModel(provider, currentState, legalActions, humanChoice);
  return { action };
}

// Workflow for consensus: run multiple models in parallel
export async function consensusWorkflow(
  providers: ModelProvider[],
  currentState: GameState,
  legalActions: Action[]
): Promise<{ actions: Array<{ provider: ModelProvider; action: Action | null; error?: string }> }> {
  "use workflow";

  // Run all models in parallel - each is a durable step
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      try {
        const action = await generateActionFromModel(provider, currentState, legalActions);
        return { provider, action };
      } catch (error) {
        return { provider, action: null, error: String(error) };
      }
    })
  );

  const actions = results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return { provider: providers[i], action: null, error: result.reason?.message || "Unknown error" };
  });

  return { actions };
}
