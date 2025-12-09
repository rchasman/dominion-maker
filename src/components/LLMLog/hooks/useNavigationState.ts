import { useReducer, useEffect, useCallback } from "react";
import type { Turn } from "../types";
import { run } from "../../../lib/run";

export interface NavigationState {
  currentTurnIndex: number;
  currentActionIndex: number;
  currentTurn: Turn | undefined;
  hasPrevTurn: boolean;
  hasNextTurn: boolean;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevTurn: () => void;
  handleNextTurn: () => void;
  handlePrevAction: () => void;
  handleNextAction: () => void;
}

interface State {
  currentTurnIndex: number;
  currentActionIndex: number;
  userNavigatedAway: boolean;
}

type Action =
  | { type: "JUMP_TO_LATEST"; lastTurnIndex: number; lastActionIndex: number }
  | { type: "PREV_TURN" }
  | { type: "NEXT_TURN"; nextTurnIndex: number }
  | { type: "PREV_ACTION" }
  | { type: "NEXT_ACTION"; isLastAction: boolean }
  | { type: "RESET_FLAG" };

function navigationReducer(state: State, action: Action): State {
  switch (action.type) {
    case "JUMP_TO_LATEST":
      return {
        currentTurnIndex: action.lastTurnIndex,
        currentActionIndex: action.lastActionIndex,
        userNavigatedAway: false,
      };

    case "PREV_TURN":
      return {
        ...state,
        currentTurnIndex: Math.max(0, state.currentTurnIndex - 1),
        currentActionIndex: 0,
        userNavigatedAway: true,
      };

    case "NEXT_TURN":
      return {
        ...state,
        currentTurnIndex: action.nextTurnIndex,
        currentActionIndex: 0,
        userNavigatedAway: true,
      };

    case "PREV_ACTION":
      return {
        ...state,
        currentActionIndex: Math.max(0, state.currentActionIndex - 1),
        userNavigatedAway: true,
      };

    case "NEXT_ACTION":
      return {
        ...state,
        currentActionIndex: state.currentActionIndex + 1,
        userNavigatedAway: !action.isLastAction,
      };

    case "RESET_FLAG":
      return { ...state, userNavigatedAway: false };

    default:
      return state;
  }
}

/**
 * Hook to manage navigation state for turns and actions
 * Handles auto-advance to latest turn/action when new data arrives
 */
export const useNavigationState = (turns: Turn[]): NavigationState => {
  const [state, dispatch] = useReducer(navigationReducer, {
    currentTurnIndex: 0,
    currentActionIndex: 0,
    userNavigatedAway: false,
  });

  // Auto-advance to latest turn and action when new data arrives
  const lastTurn = turns[turns.length - 1];
  const lastTurnDecisionsLength = lastTurn?.decisions.length;
  const lastTurnPending = lastTurn?.pending;

  useEffect(() => {
    if (state.userNavigatedAway || turns.length === 0) return;

    const lastTurnIndex = turns.length - 1;
    const lastTurn = turns[lastTurnIndex];
    const lastActionIndex = lastTurn.pending
      ? lastTurn.decisions.length
      : lastTurn.decisions.length - 1;

    // Only dispatch if we're not already at the latest
    if (
      state.currentTurnIndex !== lastTurnIndex ||
      state.currentActionIndex !== lastActionIndex
    ) {
      dispatch({
        type: "JUMP_TO_LATEST",
        lastTurnIndex,
        lastActionIndex,
      });
    }
  }, [
    turns,
    turns.length,
    lastTurnDecisionsLength,
    lastTurnPending,
    state.userNavigatedAway,
    state.currentTurnIndex,
    state.currentActionIndex,
  ]);

  // Derive computed values
  const currentTurn = turns[state.currentTurnIndex];

  const hasPrevTurn = state.currentTurnIndex > 0;
  const hasNextTurn = state.currentTurnIndex < turns.length - 1;
  const hasPrevAction = state.currentActionIndex > 0;

  const maxActionIndex = run(() => {
    if (currentTurn?.pending) return currentTurn.decisions.length;
    if (currentTurn) return currentTurn.decisions.length - 1;
    return -1;
  });

  const hasNextAction = state.currentActionIndex < maxActionIndex;

  // Event handlers
  const handlePrevTurn = useCallback(() => {
    if (hasPrevTurn) {
      dispatch({ type: "PREV_TURN" });
    }
  }, [hasPrevTurn]);

  const handleNextTurn = useCallback(() => {
    if (hasNextTurn) {
      dispatch({
        type: "NEXT_TURN",
        nextTurnIndex: state.currentTurnIndex + 1,
      });
    }
  }, [hasNextTurn, state.currentTurnIndex]);

  const handlePrevAction = useCallback(() => {
    if (hasPrevAction) {
      dispatch({ type: "PREV_ACTION" });
    }
  }, [hasPrevAction]);

  const handleNextAction = useCallback(() => {
    if (hasNextAction) {
      const isLastAction = state.currentActionIndex + 1 >= maxActionIndex;
      dispatch({ type: "NEXT_ACTION", isLastAction });
    }
  }, [hasNextAction, state.currentActionIndex, maxActionIndex]);

  return {
    currentTurnIndex: state.currentTurnIndex,
    currentActionIndex: state.currentActionIndex,
    currentTurn,
    hasPrevTurn,
    hasNextTurn,
    hasPrevAction,
    hasNextAction,
    handlePrevTurn,
    handleNextTurn,
    handlePrevAction,
    handleNextAction,
  };
};
