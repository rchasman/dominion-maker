import type { GameState } from "../types/game-state";
import type { Action } from "../types/action";
import { optimizeStateForAI } from "./state-projection";
import { encodeToon } from "../lib/toon";
import {
  formatNumberedMoves,
  replyFormatInstruction,
} from "../core/consensus/numbered-choice";
import { promptRow } from "../dominion/moves";

// Build user message with context
export function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  recentTurnsStr: string;
  legalActions: Action[];
}): string {
  const { strategicContext, currentState, recentTurnsStr, legalActions } =
    params;

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

  const legalActionsSection = [
    `LEGAL ACTIONS — you MUST choose exactly one by number:\n${formatNumberedMoves(legalActions, promptRow)}`,
    replyFormatInstruction(legalActions.length),
  ];

  const sections = [
    `CURRENT STATE:\n${stateStr}`,
    `STRATEGIC CONTEXT:\n${strategicContext}`,
    ...(recentTurnsStr ? [recentTurnsStr] : []),
    ...turnHistorySection,
    ...legalActionsSection,
  ];

  return sections.join("\n\n");
}
