import { getPlayerColor } from "../lib/board-utils";

/** A seat's name in the colour the log and the player areas give it */
export function SeatName({ playerId }: { playerId: string }) {
  return (
    <span
      title={playerId}
      style={{
        color: getPlayerColor(playerId),
        fontWeight: 600,
        fontSize: "0.625rem",
        textTransform: "uppercase",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {playerId}
    </span>
  );
}
