import type { Turn } from "../types";
import { TurnInfo } from "./TurnInfo";
import { ActionNavigationControls } from "./ActionNavigationControls";

interface DecisionInfoProps {
  currentTurn: Turn;
  currentActionIndex: number;
  timing: string;
  hasPrevAction: boolean;
  hasNextAction: boolean;
  handlePrevAction: () => void;
  handleNextAction: () => void;
}

export function DecisionInfo({
  currentTurn,
  currentActionIndex,
  timing,
  hasPrevAction,
  hasNextAction,
  handlePrevAction,
  handleNextAction,
}: DecisionInfoProps) {
  return (
    <div
      style={{
        padding: "0 var(--space-4)",
        marginTop: "var(--space-3)",
        marginBottom: "var(--space-3)",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginBottom: "var(--space-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <span>
          <TurnInfo
            currentTurn={currentTurn}
            currentActionIndex={currentActionIndex}
            timing={timing}
          />
        </span>
        <ActionNavigationControls
          hasPrevAction={hasPrevAction}
          hasNextAction={hasNextAction}
          onPrev={handlePrevAction}
          onNext={handleNextAction}
        />
      </div>
    </div>
  );
}
