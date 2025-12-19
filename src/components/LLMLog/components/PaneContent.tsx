import type { PaneType } from "./PaneTabSwitcher";
import type {
  ConsensusVotingData,
  TimingData,
  ModelStatus,
  GameStateSnapshot,
} from "../types";
import { VotingPane } from "./VotingPane";
import { PerformancePane } from "./PerformancePane";
import { ReasoningPane } from "./ReasoningPane";
import { GameStatePane } from "./GameStatePane";

interface PaneContentProps {
  activePane: PaneType;
  votingData?: ConsensusVotingData | null;
  timingData?: TimingData | null;
  modelStatuses?: Map<number, ModelStatus>;
  gameStateData?: GameStateSnapshot;
  totalModels?: number;
  now?: number;
  legalActions?: string[];
}

export function PaneContent({
  activePane,
  votingData,
  timingData,
  modelStatuses,
  gameStateData,
  totalModels,
  now,
  legalActions,
}: PaneContentProps) {
  switch (activePane) {
    case "voting":
      return (
        <VotingPane
          data={votingData}
          {...(modelStatuses !== undefined && { liveStatuses: modelStatuses })}
          {...(totalModels !== undefined && { totalModels })}
          {...(legalActions !== undefined && { legalActions })}
        />
      );
    case "performance":
      return (
        <PerformancePane
          data={timingData}
          {...(modelStatuses !== undefined && { liveStatuses: modelStatuses })}
          {...(now !== undefined && { now })}
        />
      );
    case "reasoning":
      return (
        <ReasoningPane
          {...(votingData !== undefined && { votingData })}
          {...(modelStatuses !== undefined && { modelStatuses })}
        />
      );
    case "state":
      return <GameStatePane gameState={gameStateData} />;
    default:
      return null;
  }
}
