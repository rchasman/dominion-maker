import { BoardLayout, GameAreaLayout } from "./BoardLayout";

function SkeletonAnimation() {
  return (
    <style>{`
      @keyframes subtlePulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.2; }
      }
    `}</style>
  );
}

interface SkeletonCardProps {
  size: "small" | "medium" | "large";
}

function SkeletonCard({ size }: SkeletonCardProps) {
  const width =
    size === "small"
      ? "var(--card-width-small)"
      : size === "large"
        ? "var(--card-width-large)"
        : "var(--card-width-medium)";

  return (
    <div
      style={{
        width,
        aspectRatio: "7/10",
        background: "rgb(255 255 255 / 0.08)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.25rem",
        animation: "subtlePulse 3s ease-in-out infinite",
      }}
    />
  );
}

interface SkeletonPlayerAreaProps {
  inverted: boolean;
}

function SkeletonPlayerArea({ inverted }: SkeletonPlayerAreaProps) {
  const inPlaySection = (
    <div
      style={{
        minHeight: "5.625rem",
        padding: "var(--space-2)",
        background: "rgb(255 255 255 / 0.05)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.25rem",
        marginBlockStart: inverted ? "var(--space-2)" : "0",
        marginBlockEnd: inverted ? "0" : "var(--space-2)",
      }}
    />
  );

  return (
    <div
      style={{
        padding: "var(--space-1) var(--space-2)",
        background: "rgb(255 255 255 / 0.05)",
        border: "1px solid var(--color-border)",
        overflow: "auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBlockEnd: "var(--space-2)",
        }}
      >
        <div
          style={{
            width: "8rem",
            height: "1rem",
            background: "rgb(255 255 255 / 0.12)",
            borderRadius: "0.25rem",
            animation: "subtlePulse 3s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "3rem",
            height: "1rem",
            background: "rgb(255 255 255 / 0.12)",
            borderRadius: "0.25rem",
            animation: "subtlePulse 3s ease-in-out infinite",
          }}
        />
      </div>

      {!inverted && inPlaySection}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "75% 24.5%",
          gap: "var(--space-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            padding: "var(--space-2)",
            background: "rgb(255 255 255 / 0.05)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.25rem",
            minHeight: "8rem",
          }}
        >
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonCard key={i} size="large" />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-2)",
              background: "rgb(255 255 255 / 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.25rem",
            }}
          >
            <SkeletonCard size="medium" />
            <div
              style={{
                width: "3rem",
                height: "0.75rem",
                background: "rgb(255 255 255 / 0.12)",
                borderRadius: "0.25rem",
                animation: "subtlePulse 3s ease-in-out infinite",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-2)",
              background: "rgb(255 255 255 / 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.25rem",
            }}
          >
            <SkeletonCard size="medium" />
            <div
              style={{
                width: "3rem",
                height: "0.75rem",
                background: "rgb(255 255 255 / 0.12)",
                borderRadius: "0.25rem",
                animation: "subtlePulse 3s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>

      {inverted && inPlaySection}
    </div>
  );
}

function SkeletonSupply() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto",
        gridTemplateAreas: '"victory treasure kingdom curse trash"',
        gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        background: "rgba(70, 70, 95, 0.25)",
        backdropFilter: "blur(12px)",
        borderRadius: "0.5rem",
        alignItems: "start",
        alignContent: "start",
      }}
    >
      <div
        style={{ gridArea: "victory", paddingInlineStart: "var(--space-4)" }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-victory)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          VICTORY
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} size="small" />
          ))}
        </div>
      </div>

      <div style={{ gridArea: "treasure" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-treasure)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          TREASURE
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} size="small" />
          ))}
        </div>
      </div>

      <div style={{ gridArea: "kingdom" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          KINGDOM
        </div>
        <div
          className="kingdom-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, var(--card-width-large)))",
            gap: "var(--space-2)",
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <SkeletonCard key={i} size="large" />
          ))}
        </div>
      </div>

      <div style={{ gridArea: "curse" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-curse)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          CURSE
        </div>
        <SkeletonCard size="small" />
      </div>

      <div
        style={{ gridArea: "trash", paddingInlineEnd: "var(--space-4)" }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          TRASH
        </div>
        <div
          style={{
            width: "var(--card-width-small)",
            height: "3rem",
            background: "rgb(255 255 255 / 0.08)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.25rem",
            animation: "subtlePulse 3s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

function SkeletonSidebar() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-bg-secondary)",
        borderLeft: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          flex: "0 0 40%",
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-victory)",
            marginBlockEnd: "var(--space-3)",
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          GAME LOG
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[90, 75, 85, 70, 80, 65].map((width, i) => (
            <div
              key={i}
              style={{
                width: `${width}%`,
                height: "0.75rem",
                background: "rgb(255 255 255 / 0.12)",
                borderRadius: "0.25rem",
                animation: "subtlePulse 3s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          height: "8px",
          background: "var(--color-bg-surface)",
          borderTop: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "ns-resize",
        }}
      >
        <div
          style={{
            width: "2rem",
            height: "2px",
            background: "var(--color-border)",
            borderRadius: "1px",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-3)",
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: "0.05em",
            opacity: 0.7,
          }}
        >
          LLM LOG
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[85, 70, 80, 75].map((width, i) => (
            <div
              key={i}
              style={{
                width: `${width}%`,
                height: "0.75rem",
                background: "rgb(255 255 255 / 0.08)",
                borderRadius: "0.25rem",
                animation: "subtlePulse 3s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        {[1, 2].map(i => (
          <div
            key={i}
            style={{
              width: "100%",
              height: "2.25rem",
              background: "rgb(255 255 255 / 0.12)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.25rem",
              animation: "subtlePulse 3s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading game...">
      <SkeletonAnimation />
      <BoardLayout isPreviewMode={false}>
        <GameAreaLayout isPreviewMode={false}>
          <SkeletonPlayerArea inverted={true} />
          <SkeletonSupply />
          <SkeletonPlayerArea inverted={false} />
        </GameAreaLayout>
        <SkeletonSidebar />
      </BoardLayout>
    </div>
  );
}
