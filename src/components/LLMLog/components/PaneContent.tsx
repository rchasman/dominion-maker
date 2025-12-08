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
}

export function PaneContent({
  activePane,
  votingData,
  timingData,
  modelStatuses,
  gameStateData,
  totalModels,
  now,
}: PaneContentProps) {
  switch (activePane) {
    case "voting":
      return (
        <VotingPane
          data={votingData}
          liveStatuses={modelStatuses}
          totalModels={totalModels}
        />
      );
    case "performance":
      return (
        <PerformancePane
          data={timingData}
          liveStatuses={modelStatuses}
          now={now}
        />
      );
    case "reasoning":
      return (
        <ReasoningPane votingData={votingData} modelStatuses={modelStatuses} />
      );
    case "state":
      return <GameStatePane gameState={gameStateData} />;
    default:
      return null;
  }
}
