import { useMemo } from "react";
import type { Action } from "../../../types/action";
import type { LLMLogEntry, Turn, PendingData } from "../types";

/**
 * Hook to extract and build turns from log entries
 * Returns an array of Turn objects representing consensus decisions
 */
export const useTurnExtraction = (entries: LLMLogEntry[]): Turn[] => {
  return useMemo(() => {
    const turns: Turn[] = [];
    let buildingTurn: Turn | null = null;
    let stepNumber = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Start a new turn for AI's main turn
      if (entry.type === "ai-turn-start") {
        if (buildingTurn && buildingTurn.decisions.length > 0) {
          turns.push(buildingTurn);
        }
        buildingTurn = {
          turnNumber: turns.length + 1,
          gameTurn: entry.data?.turn as number | undefined,
          decisions: [],
        };
        stepNumber = 0;
      }

      // Start a new turn for AI sub-phase responses (e.g., responding to Militia during human's turn)
      if (entry.type === "ai-decision-resolving") {
        if (buildingTurn && buildingTurn.decisions.length > 0) {
          turns.push(buildingTurn);
        }
        const decisionType = entry.data?.decisionType || "decision";
        const prompt = (entry.data?.prompt as string) || "";
        // Extract card name from prompt if present (e.g., "Militia: Discard..." or "Militia attack: Discard...")
        const cardMatch = prompt.match(/^(\w+)(?:\s+attack)?:/i);
        const cardName = cardMatch ? cardMatch[1] : null;

        buildingTurn = {
          turnNumber: turns.length + 1,
          gameTurn: entry.data?.turn as number | undefined,
          decisions: [],
          isSubPhase: true,
          subPhaseLabel: cardName
            ? `Response to ${cardName}`
            : `AI ${decisionType}`,
        };
        stepNumber = 0;
      }

      // Handle consensus-start - mark turn as pending
      if (entry.type === "consensus-start") {
        if (!buildingTurn) {
          // Create a new turn if none exists
          buildingTurn = {
            turnNumber: turns.length + 1,
            gameTurn: entry.data?.turn as number | undefined,
            decisions: [],
            pending: true,
            pendingData: entry.data as PendingData | undefined,
            modelStatuses: new Map(),
            consensusStartTime: entry.timestamp,
          };
        } else {
          // Mark existing turn as pending (new action starting)
          buildingTurn.pending = true;
          buildingTurn.pendingData = entry.data as PendingData | undefined;
          buildingTurn.modelStatuses = new Map();
          buildingTurn.consensusStartTime = entry.timestamp;
        }
      }

      // Track individual model starts
      if (entry.type === "consensus-model-pending" && buildingTurn) {
        const data = entry.data || {};
        const provider = data.provider as string;
        const index = data.index as number;
        const startTime = data.startTime as number;
        if (index !== undefined) {
          buildingTurn.modelStatuses?.set(index, {
            provider,
            index,
            startTime,
            completed: false,
          });
        }
      }

      // Track individual model completions
      if (entry.type === "consensus-model-complete" && buildingTurn) {
        const data = entry.data || {};
        const index = data.index as number | undefined;
        const duration = data.duration as number | undefined;
        const success = data.success as boolean | undefined;
        const action = data.action as Action | undefined;
        const aborted = data.aborted as boolean | undefined;
        if (index !== undefined && buildingTurn.modelStatuses?.has(index)) {
          const status = buildingTurn.modelStatuses.get(index)!;
          status.duration = duration;
          status.success = success;
          status.completed = true;
          status.action = action;
          status.aborted = aborted;
        }
      }

      // Track aborted models (skipped due to early consensus)
      if (entry.type === "consensus-model-aborted" && buildingTurn) {
        const data = entry.data || {};
        const index = data.index as number | undefined;
        const duration = data.duration as number | undefined;
        if (index !== undefined && buildingTurn.modelStatuses?.has(index)) {
          const status = buildingTurn.modelStatuses.get(index)!;
          status.duration = duration;
          status.completed = true;
          status.aborted = true;
        }
      }

      // Look for consensus-voting entries (these represent a decision)
      if (entry.type === "consensus-voting" && buildingTurn) {
        stepNumber++;
        buildingTurn.pending = false; // No longer pending

        // Look backward for the corresponding timing entry
        let timingEntry: LLMLogEntry | undefined;
        for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
          if (entries[j].type === "consensus-compare") {
            timingEntry = entries[j];
            break;
          }
        }

        // Snapshot modelStatuses for this decision
        const modelStatusesSnapshot = buildingTurn.modelStatuses
          ? new Map(buildingTurn.modelStatuses)
          : undefined;

        buildingTurn.decisions.push({
          id: entry.id,
          votingEntry: entry,
          timingEntry,
          stepNumber,
          modelStatuses: modelStatusesSnapshot,
        });
      }
    }

    // Add the last turn if it has decisions OR is pending
    if (
      buildingTurn &&
      (buildingTurn.decisions.length > 0 || buildingTurn.pending)
    ) {
      turns.push(buildingTurn);
    }

    return turns;
  }, [entries]);
};
