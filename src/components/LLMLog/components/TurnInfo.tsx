import type { Turn } from "../types";

interface TurnInfoProps {
  currentTurn: Turn;
  currentActionIndex: number;
  timing?: string;
}

export function TurnInfo({
  currentTurn,
  currentActionIndex,
  timing,
}: TurnInfoProps) {
  if (currentTurn.isSubPhase) {
    return (
      <>
        <span style={{ color: "var(--color-victory)" }}>
          {currentTurn.subPhaseLabel || "Sub-phase"}: {currentActionIndex + 1}{" "}
          of{" "}
          {currentTurn.pending
            ? currentTurn.decisions.length + 1
            : currentTurn.decisions.length}{" "}
        </span>
        {timing && (
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--color-gold)",
              fontWeight: 400,
            }}
          >
            ({timing})
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {currentTurn.gameTurn && `Turn #${currentTurn.gameTurn}: `}
      Action {currentActionIndex + 1} of{" "}
      {currentTurn.pending
        ? currentTurn.decisions.length + 1
        : currentTurn.decisions.length}{" "}
      {timing && (
        <span
          style={{
            fontSize: "0.7rem",
            color: "var(--color-gold)",
            fontWeight: 400,
          }}
        >
          ({timing})
        </span>
      )}
    </>
  );
}
