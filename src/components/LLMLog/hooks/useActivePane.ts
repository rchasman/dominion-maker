import { useState, useCallback } from "react";
import type { PaneType } from "../components/PaneTabSwitcher";
import type { ConsensusDecision } from "../types";

export function useActivePane(currentDecision: ConsensusDecision | undefined) {
  const [activePaneState, setActivePaneState] = useState<PaneType>(() => {
    const saved = localStorage.getItem("llm-log-active-pane");
    return (saved as PaneType | null) || "voting";
  });

  const setActivePane = useCallback((pane: PaneType) => {
    setActivePaneState(pane);
    localStorage.setItem("llm-log-active-pane", pane);
  }, []);

  const activePane =
    currentDecision &&
    !currentDecision.timingEntry &&
    activePaneState === "performance"
      ? "voting"
      : activePaneState;

  return { activePane, setActivePane };
}
