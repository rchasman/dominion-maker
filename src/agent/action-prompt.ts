import type { GameState } from "../types/game-state";
import type { Action } from "../types/action";
import { optimizeStateForAI } from "./state-projection";
import { encodeToon } from "../lib/toon";
import { formatLegalActions, replyFormatInstruction } from "./choice-parsing";

// Build user message with context
export function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  recentTurnsStr: string;
  legalActions: Action[];
  humanChoice?: { selectedCards: string[] } | undefined;
}): string {
  const {
    strategicContext,
    currentState,
    recentTurnsStr,
    legalActions,
    humanChoice,
  } = params;

  // Optimize state by converting arrays to counts
  const optimizedState = optimizeStateForAI(currentState);

  // Build structured prompt sections: state → strategy → history → options → decision
  const stateStr = encodeToon(optimizedState);

  const turnHistorySection =
    currentState.turnHistory && currentState.turnHistory.length > 0
      ? [
          `ACTIONS TAKEN THIS TURN (by ${currentState.activePlayerId}):\n${encodeToon(currentState.turnHistory)}`,
        ]
      : [];

  const humanChoiceSection = humanChoice
    ? [`Human chose: ${encodeToon(humanChoice.selectedCards)}`]
    : [];

  const legalActionsSection = [
    `LEGAL ACTIONS — you MUST choose exactly one by number:\n${formatLegalActions(legalActions)}`,
    replyFormatInstruction(legalActions.length),
  ];

  const sections = [
    `CURRENT STATE:\n${stateStr}`,
    `STRATEGIC CONTEXT:\n${strategicContext}`,
    ...(recentTurnsStr ? [recentTurnsStr] : []),
    ...turnHistorySection,
    ...humanChoiceSection,
    ...legalActionsSection,
  ];

  return sections.join("\n\n");
}
