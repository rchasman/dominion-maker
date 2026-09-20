import { useState, useEffect } from "preact/hooks";
import { CYCLING_GLYPH_INTERVAL_MS } from "./constants";

function CyclingSquare() {
  const glyphs = ["▤", "▥", "▦"];
  const [startTime] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(
      () => setNow(Date.now()),
      CYCLING_GLYPH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const index =
    Math.floor((now - startTime) / CYCLING_GLYPH_INTERVAL_MS) % glyphs.length;

  return <span>{glyphs[index]}</span>;
}

/** Who the table is waiting on: a bot deciding, the viewer, or nobody */
export type TurnStatus = "thinking" | "yours" | null;

interface TurnStatusIndicatorProps {
  status: TurnStatus;
  color: string;
}

export function TurnStatusIndicator({
  status,
  color,
}: TurnStatusIndicatorProps) {
  if (status === "thinking") {
    return (
      <div
        style={{
          color,
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBlockStart: "var(--space-2)",
          animation: "pulse 1.5s ease-in-out infinite",
          fontStyle: "italic",
        }}
      >
        <span
          style={{
            display: "inline-block",
            animation: "spin 1s linear infinite",
          }}
        >
          ⚙
        </span>
        <span>AI thinking...</span>
      </div>
    );
  }

  if (status === "yours") {
    return (
      <div
        style={{
          color,
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBlockStart: "var(--space-2)",
        }}
      >
        <span style={{ display: "inline-block" }}>
          <CyclingSquare />
        </span>
        <span>Your turn...</span>
      </div>
    );
  }

  return null;
}
