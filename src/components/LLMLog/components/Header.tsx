import { TurnNavigationButtons } from "./TurnNavigationButtons";
import { SettingsButton } from "./SettingsButton";
import type { LlmSeat } from "../types";

interface HeaderProps {
  turnsCount: number;
  currentTurnIndex: number;
  hasPrevTurn: boolean;
  hasNextTurn: boolean;
  handlePrevTurn: () => void;
  handleNextTurn: () => void;
  isModelSettingsExpanded: boolean;
  setIsModelSettingsExpanded: (expanded: boolean) => void;
  hasModelSettings: boolean;
  llmSeats: LlmSeat[];
  selectedSeat: string | null;
  onSelectSeat: (playerId: string) => void;
}

function SeatPicker({
  llmSeats,
  selectedSeat,
  onSelectSeat,
}: Pick<HeaderProps, "llmSeats" | "selectedSeat" | "onSelectSeat">) {
  if (llmSeats.length < 2) return null;
  return (
    <select
      className="seat-selector"
      aria-label="LLM seat to configure"
      value={selectedSeat ?? ""}
      onChange={event => {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) onSelectSeat(target.value);
      }}
    >
      {llmSeats.map(seat => (
        <option key={seat.playerId} value={seat.playerId}>
          {seat.playerId}
        </option>
      ))}
    </select>
  );
}

export function Header({
  turnsCount,
  currentTurnIndex,
  hasPrevTurn,
  hasNextTurn,
  handlePrevTurn,
  handleNextTurn,
  isModelSettingsExpanded,
  setIsModelSettingsExpanded,
  hasModelSettings,
  llmSeats,
  selectedSeat,
  onSelectSeat,
}: HeaderProps) {
  return (
    <div
      style={{
        padding: "var(--space-5)",
        paddingBlockEnd: "var(--space-3)",
        borderBlockEnd: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          textTransform: "uppercase",
          fontSize: "0.625rem",
          color: "var(--color-gold)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            width: "100%",
          }}
        >
          <span style={{ flex: 1 }}>Consensus Viewer</span>
          {hasModelSettings && (
            <SeatPicker
              llmSeats={llmSeats}
              selectedSeat={selectedSeat}
              onSelectSeat={onSelectSeat}
            />
          )}
          {hasModelSettings && (
            <SettingsButton
              isExpanded={isModelSettingsExpanded}
              onClick={() =>
                setIsModelSettingsExpanded(!isModelSettingsExpanded)
              }
            />
          )}
          {turnsCount > 0 && (
            <TurnNavigationButtons
              currentTurnIndex={currentTurnIndex}
              turnsCount={turnsCount}
              hasPrevTurn={hasPrevTurn}
              hasNextTurn={hasNextTurn}
              handlePrevTurn={handlePrevTurn}
              handleNextTurn={handleNextTurn}
            />
          )}
        </div>
      </div>
    </div>
  );
}
