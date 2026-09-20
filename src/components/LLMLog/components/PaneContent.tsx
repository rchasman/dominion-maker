import type { PaneType } from "./PaneTabSwitcher";
import type {
  ConsensusVotingData,
  ConsensusVerdict,
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
  modelStatuses?: Map<number, ModelStatus>;
  gameStateData?: GameStateSnapshot;
  totalModels?: number;
  now?: number;
  legalKeys?: string[];
  verdict?: ConsensusVerdict;
}

export function PaneContent({
  activePane,
  votingData,
  modelStatuses,
  gameStateData,
  totalModels,
  now,
  legalKeys,
  verdict,
}: PaneContentProps) {
  switch (activePane) {
    case "voting":
      return (
        <VotingPane
          data={votingData}
          {...(modelStatuses !== undefined && { liveStatuses: modelStatuses })}
          {...(totalModels !== undefined && { totalModels })}
          {...(legalKeys !== undefined && { legalKeys })}
          {...(verdict !== undefined && { verdict })}
        />
      );
    case "performance":
      return (
        <PerformancePane
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
