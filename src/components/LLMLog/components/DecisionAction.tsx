import type {
  Turn,
  ConsensusDecision,
  ConsensusVotingData,
  TimingData,
  GameStateSnapshot,
} from "../types";
import type { PaneType } from "./PaneTabSwitcher";
import { PaneTabSwitcher } from "./PaneTabSwitcher";
import { PaneContent } from "./PaneContent";
import { DecisionInfo } from "./DecisionInfo";

const MS_PER_SECOND = 1000;
const TIMING_DECIMAL_PLACES = 2;

interface DecisionActionProps {
  currentTurn: Turn;
  currentDecision: ConsensusDecision;
  currentActionIndex: number;
  activePane: PaneType;
  setActivePane: (pane: PaneType) => void;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevAction: () => void;
  handleNextAction: () => void;
  now: number;
}

export function DecisionAction({
  currentTurn,
  currentDecision,
  currentActionIndex,
  activePane,
  setActivePane,
  hasPrevAction,
  hasNextAction,
  handlePrevAction,
  handleNextAction,
  now,
}: DecisionActionProps) {
  const timing = `${(
    (Number(currentDecision.timingEntry?.data?.parallelDuration) || 0) /
    MS_PER_SECOND
  ).toFixed(TIMING_DECIMAL_PLACES)}s`;

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

      <PaneTabSwitcher
        activePane={activePane}
        onPaneChange={setActivePane}
        hidePerformance={!currentDecision.timingEntry}
      />

      <PaneContent
        activePane={activePane}
        votingData={
          currentDecision.votingEntry.data as unknown as ConsensusVotingData
        }
        timingData={currentDecision.timingEntry?.data as TimingData | undefined}
        modelStatuses={currentDecision.modelStatuses}
        gameStateData={
          currentDecision.votingEntry.data?.gameState as
            | GameStateSnapshot
            | undefined
        }
        totalModels={
          Number(
            (
              currentDecision.votingEntry.data as unknown as {
                topResult?: { totalVotes?: number };
              }
            )?.topResult?.totalVotes,
          ) || 0
        }
        now={now}
      />
    </>
  );
}
