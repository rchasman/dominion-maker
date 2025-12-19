import type { Turn } from "../types";
import type { PaneType } from "./PaneTabSwitcher";
import { PaneTabSwitcher } from "./PaneTabSwitcher";
import { PaneContent } from "./PaneContent";
import { DecisionInfo } from "./DecisionInfo";

interface PendingActionProps {
  currentTurn: Turn;
  currentActionIndex: number;
  activePane: PaneType;
  setActivePane: (pane: PaneType) => void;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevAction: () => void;
  handleNextAction: () => void;
  now: number;
}

export function PendingAction({
  currentTurn,
  currentActionIndex,
  activePane,
  setActivePane,
  hasPrevAction,
  hasNextAction,
  handlePrevAction,
  handleNextAction,
  now,
}: PendingActionProps) {
  const timing = `${
    Array.from(currentTurn.modelStatuses?.values() || []).filter(
      s => s.completed,
    ).length
  }/${currentTurn.pendingData?.totalModels || "?"}`;

  return (
    <>
      <DecisionInfo
        currentTurn={currentTurn}
        currentActionIndex={currentActionIndex}
        timing={timing}
        hasPrevAction={hasPrevAction}
        hasNextAction={hasNextAction}
        handlePrevAction={handlePrevAction}
        handleNextAction={handleNextAction}
      />
      <PaneTabSwitcher activePane={activePane} onPaneChange={setActivePane} />
      <PaneContent
        activePane={activePane}
        votingData={null}
        timingData={null}
        {...(currentTurn.modelStatuses !== undefined && {
          modelStatuses: currentTurn.modelStatuses,
        })}
        {...(currentTurn.pendingData?.gameState !== undefined && {
          gameStateData: currentTurn.pendingData.gameState,
        })}
        {...(currentTurn.pendingData?.totalModels !== undefined && {
          totalModels: currentTurn.pendingData.totalModels,
        })}
        now={now}
        {...(currentTurn.pendingData?.gameState?.legalActions !== undefined && {
          legalActions: currentTurn.pendingData.gameState.legalActions,
        })}
      />
    </>
  );
}
