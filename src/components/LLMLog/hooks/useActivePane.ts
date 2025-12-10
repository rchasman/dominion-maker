import { useState, useCallback } from "react";
import type { PaneType } from "../components/PaneTabSwitcher";

export function useActivePane() {
  const [activePane, setActivePaneState] = useState<PaneType>(() => {
    const saved = localStorage.getItem("llm-log-active-pane");
    return (saved as PaneType | null) || "voting";
  });

  const setActivePane = useCallback((pane: PaneType) => {
    setActivePaneState(pane);
    localStorage.setItem("llm-log-active-pane", pane);
  }, []);

  return { activePane, setActivePane };
}
