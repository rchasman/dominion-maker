import type { ComponentChildren } from "preact";

interface DecisionPanelFrameProps {
  label: string;
  children: ComponentChildren;
}

export function DecisionPanelFrame({
  label,
  children,
}: DecisionPanelFrameProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        width: "min(700px, 90%)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "rgba(26, 26, 46, 0.75)",
          backdropFilter: "blur(12px)",
          border: "2px solid rgb(205 133 63)",
          padding: "var(--space-3)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
          maxHeight: "50vh",
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "var(--space-1)",
            left: "var(--space-2)",
            fontSize: "0.625rem",
            color: "rgb(205 133 63)",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}
