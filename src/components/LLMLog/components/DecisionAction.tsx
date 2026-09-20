import type {
  Turn,
  ConsensusDecision,
  ConsensusVotingData,
  GameStateSnapshot,
} from "../types";
import type { PaneType } from "./PaneTabSwitcher";
import { PaneTabSwitcher } from "./PaneTabSwitcher";
import { PaneContent } from "./PaneContent";
import { DecisionInfo } from "./DecisionInfo";
import { costOf, formatCost } from "../../../core/consensus/cost";

const MS_PER_SECOND = 1000;
const TIMING_DECIMAL_PLACES = 2;

/** Every model that answered this decision, at the catalog's rates */
const decisionCost = (decision: ConsensusDecision): number =>
  [...(decision.modelStatuses?.values() ?? [])].reduce(
    (total, status) => total + costOf(status.provider, status.usage),
    0,
  );

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

/** A relayed entry's data is unknown-shaped until something checks it */
const isKeyList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

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
  const seconds = `${(
    (Number(currentDecision.votingEntry.data?.votingDuration) || 0) /
    MS_PER_SECOND
  ).toFixed(TIMING_DECIMAL_PLACES)}s`;
  const cost = decisionCost(currentDecision);
  const timing = cost > 0 ? `${seconds} · ${formatCost(cost)}` : seconds;

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
        {...(currentDecision.verdict !== undefined && {
          verdict: currentDecision.verdict,
        })}
        votingData={
          currentDecision.votingEntry.data as unknown as ConsensusVotingData
        }
        {...(currentDecision.modelStatuses !== undefined && {
          modelStatuses: currentDecision.modelStatuses,
        })}
        {...((currentDecision.votingEntry.data?.gameState as
          | GameStateSnapshot
          | undefined) !== undefined && {
          gameStateData: currentDecision.votingEntry.data
            ?.gameState as GameStateSnapshot,
        })}
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
        {...(isKeyList(currentDecision.votingEntry.data?.["legalKeys"]) && {
          legalKeys: currentDecision.votingEntry.data["legalKeys"],
        })}
      />
    </>
  );
}
