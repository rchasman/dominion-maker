import { useEffect, useReducer, useRef } from "react";
import type { Turn } from "../types";

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
  | { type: "PREV_TURN"; prevTurnIndex: number; actionIndex?: number }
  | { type: "NEXT_TURN"; nextTurnIndex: number }
  | { type: "PREV_ACTION"; prevActionIndex: number }
  | { type: "NEXT_ACTION"; isLastAction: boolean }
  | { type: "RESET_NAVIGATION" };

function navigationReducer(state: State, action: Action): State {
  switch (action.type) {
    case "PREV_TURN":
      return {
        ...state,
        currentTurnIndex: action.prevTurnIndex,
        currentActionIndex: action.actionIndex ?? 0,
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
        currentActionIndex: action.prevActionIndex,
        userNavigatedAway: true,
      };

    case "NEXT_ACTION":
      return {
        ...state,
        currentActionIndex: state.currentActionIndex + 1,
        userNavigatedAway: !action.isLastAction,
      };

    case "RESET_NAVIGATION":
      return {
        ...state,
        userNavigatedAway: false,
      };

    default:
      return state;
  }
}

/**
 * Hook to manage navigation state for turns and actions
 * Auto-advances to latest by deriving effective indices
 */
export const useNavigationState = (turns: Turn[]): NavigationState => {
  const [state, dispatch] = useReducer(navigationReducer, {
    currentTurnIndex: 0,
    currentActionIndex: 0,
    userNavigatedAway: false,
  });

  // Track previous turn count to detect when AI begins new turn
  const prevTurnCountRef = useRef(turns.length);

  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      // New turn detected - reset to auto-follow latest
      dispatch({ type: "RESET_NAVIGATION" });
    }
    prevTurnCountRef.current = turns.length;
  }, [turns.length]);

  // Derive latest indices
  const latestTurnIndex = Math.max(0, turns.length - 1);
  const latestTurn = turns[latestTurnIndex];
  const latestActionIndex = latestTurn?.pending
    ? latestTurn.decisions.length
    : Math.max(0, (latestTurn?.decisions.length || 0) - 1);

  // Auto-advance: use manual position if navigated away, otherwise latest
  const currentTurnIndex = state.userNavigatedAway
    ? state.currentTurnIndex
    : latestTurnIndex;
  const currentActionIndex = state.userNavigatedAway
    ? state.currentActionIndex
    : latestActionIndex;

  const currentTurn = turns[currentTurnIndex];

  // Derive booleans
  const hasPrevTurn = currentTurnIndex > 0;
  const hasNextTurn = currentTurnIndex < turns.length - 1;
  // Can go back if either: action > 0 in current turn, OR at action 0 with previous turn available
  const hasPrevAction = currentActionIndex > 0 || (currentActionIndex === 0 && hasPrevTurn);

  const maxActionIndex = currentTurn?.pending
    ? currentTurn.decisions.length
    : Math.max(0, (currentTurn?.decisions.length || 0) - 1);
  // Can go forward if either: action < max in current turn, OR at last action with next turn available
  const hasNextAction = currentActionIndex < maxActionIndex || (currentActionIndex === maxActionIndex && hasNextTurn);

  // Handlers - plain functions, no useCallback
  const handlePrevTurn = () => {
    if (hasPrevTurn) {
      dispatch({ type: "PREV_TURN", prevTurnIndex: currentTurnIndex - 1 });
    }
  };

  const handleNextTurn = () => {
    if (hasNextTurn) {
      dispatch({
        type: "NEXT_TURN",
        nextTurnIndex: currentTurnIndex + 1,
      });
    }
  };

  const handlePrevAction = () => {
    if (currentActionIndex > 0) {
      // Go back within current turn
      dispatch({
        type: "PREV_ACTION",
        prevActionIndex: currentActionIndex - 1,
      });
    } else if (hasPrevTurn) {
      // At action 0, wrap to previous turn's last action
      const prevTurn = turns[currentTurnIndex - 1];
      const prevTurnLastActionIndex = prevTurn.pending
        ? prevTurn.decisions.length
        : Math.max(0, prevTurn.decisions.length - 1);

      dispatch({
        type: "PREV_TURN",
        prevTurnIndex: currentTurnIndex - 1,
        actionIndex: prevTurnLastActionIndex,
      });
    }
  };

  const handleNextAction = () => {
    if (currentActionIndex < maxActionIndex) {
      // Go forward within current turn
      const isLastAction = currentActionIndex + 1 >= maxActionIndex;
      dispatch({ type: "NEXT_ACTION", isLastAction });
    } else if (hasNextTurn) {
      // At last action, wrap to next turn's first action
      dispatch({
        type: "NEXT_TURN",
        nextTurnIndex: currentTurnIndex + 1,
      });
    }
  };

  return {
    currentTurnIndex,
    currentActionIndex,
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
