import type { Turn, ConsensusDecision } from "../types";
import type { PaneType } from "./PaneTabSwitcher";
import { EmptyState } from "./EmptyState";
import { PendingAction } from "./PendingAction";
import { DecisionAction } from "./DecisionAction";

interface MainContentProps {
  turns: Turn[];
  currentTurn: Turn | undefined;
  currentDecision: ConsensusDecision | undefined;
  currentActionIndex: number;
  hasLlmSeats: boolean;
  activePane: PaneType;
  setActivePane: (pane: PaneType) => void;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevAction: () => void;
  handleNextAction: () => void;
  now: number;
}

export function MainContent({
  turns,
  currentTurn,
  currentDecision,
  currentActionIndex,
  hasLlmSeats,
  activePane,
  setActivePane,
  hasPrevAction,
  hasNextAction,
  handlePrevAction,
  handleNextAction,
  now,
}: MainContentProps) {
  if (turns.length === 0) {
    return <EmptyState hasLlmSeats={hasLlmSeats} />;
  }

  if (
    currentTurn?.pending &&
    currentActionIndex === currentTurn.decisions.length
  ) {
    return (
      <PendingAction
        currentTurn={currentTurn}
        currentActionIndex={currentActionIndex}
        activePane={activePane}
        setActivePane={setActivePane}
        hasPrevAction={hasPrevAction}
        hasNextAction={hasNextAction}
        handlePrevAction={handlePrevAction}
        handleNextAction={handleNextAction}
        now={now}
      />
    );
  }

  if (currentDecision && currentTurn) {
    return (
      <DecisionAction
        currentTurn={currentTurn}
        currentDecision={currentDecision}
        currentActionIndex={currentActionIndex}
        activePane={activePane}
        setActivePane={setActivePane}
        hasPrevAction={hasPrevAction}
        hasNextAction={hasNextAction}
        handlePrevAction={handlePrevAction}
        handleNextAction={handleNextAction}
        now={now}
      />
    );
  }

  return null;
}
