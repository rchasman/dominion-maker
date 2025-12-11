import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { Card } from "../Card";
import { DEFAULT_LOG_HEIGHT_PERCENT } from "./constants";

const STORAGE_LOG_HEIGHT_KEY = "dominion-maker-log-height";

function getStoredLogHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_LOG_HEIGHT_KEY);
    return saved ? parseFloat(saved) : DEFAULT_LOG_HEIGHT_PERCENT;
  } catch {
    return DEFAULT_LOG_HEIGHT_PERCENT;
  }
}

interface SkeletonCardProps {
  size: "small" | "medium" | "large";
}

function SkeletonCard({ size }: SkeletonCardProps) {
  return (
    <div style={{ opacity: 0.15 }}>
      <Card
        name="Copper"
        showBack={true}
        size={size}
        disabled={true}
        disableTooltip={true}
      />
    </div>
  );
}

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

function SkeletonPlayerLabelSection() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        paddingBlock: "var(--space-1)",
      }}
    >
      <div
        style={{
          width: "8rem",
          height: "0.8125rem",
          background: "rgb(255 255 255 / 0.12)",
          borderRadius: "0.25rem",
          animation: "subtlePulse 3s ease-in-out infinite",
        }}
      />
      <div
        style={{
          width: "3rem",
          height: "0.8125rem",
          background: "rgb(255 255 255 / 0.12)",
          borderRadius: "0.25rem",
          animation: "subtlePulse 3s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function SkeletonInPlaySection({ inverted }: { inverted: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "var(--space-2)",
        marginBlockStart: inverted ? "var(--space-2)" : undefined,
        marginBlockEnd: inverted ? undefined : "var(--space-2)",
        background: "rgb(255 255 255 / 0.02)",
        border: "1px dashed var(--color-border)",
        minBlockSize: "calc(var(--card-height-small) + var(--space-4) + 12px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          insetBlockStart: "var(--space-1)",
          insetInlineStart: "var(--space-2)",
          fontSize: "0.5625rem",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          fontWeight: 600,
          animation: "subtlePulse 3s ease-in-out infinite",
        }}
      >
        In Play (empty)
      </div>
    </div>
  );
}

function SkeletonHandSection() {
  return (
    <div
      className="hand-container"
      style={{
        position: "relative",
        minInlineSize: 0,
        padding: "var(--space-2)",
        background: "rgb(255 255 255 / 0.05)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          insetBlockStart: "var(--space-1)",
          insetInlineStart: "var(--space-2)",
          fontSize: "0.5625rem",
          color: "var(--color-text-muted)",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        Hand (5)
      </div>
      <div className="hand-grid">
        {[1, 2, 3, 4, 5].map(i => (
          <SkeletonCard key={i} size="large" />
        ))}
      </div>
    </div>
  );
}

function SkeletonDeckDiscardSection() {
  return (
    <div
      className="deck-discard-container"
      style={{
        padding: "var(--space-2)",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        minHeight: 0,
      }}
    >
      <div className="deck-discard-wrapper" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.5625rem",
              color: "rgb(205 133 63)",
              marginBlockEnd: "var(--space-2)",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Deck
          </div>
          <SkeletonCard size="medium" />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.5625rem",
              color: "rgb(180 180 180)",
              marginBlockEnd: "var(--space-2)",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Discard
          </div>
          <SkeletonCard size="medium" />
        </div>
      </div>
    </div>
  );
}

function SkeletonHandAndDeckGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "75% 24.5%",
        gap: "var(--space-2)",
        alignItems: "stretch",
      }}
    >
      <SkeletonHandSection />
      <SkeletonDeckDiscardSection />
    </div>
  );
}

interface SkeletonPlayerAreaProps {
  inverted: boolean;
}

function SkeletonPlayerArea({ inverted }: SkeletonPlayerAreaProps) {
  return (
    <div
      style={{
        padding: inverted
          ? "var(--space-1) var(--space-2) 0 var(--space-2)"
          : "0 var(--space-2) var(--space-1) var(--space-2)",
        border: "1px solid var(--color-border)",
        background: "rgb(255 255 255 / 0.05)",
        overflow: "auto",
        minHeight: 0,
      }}
    >
      {inverted ? (
        <>
          <SkeletonHandAndDeckGrid />
          <SkeletonInPlaySection inverted={inverted} />
          <SkeletonPlayerLabelSection />
        </>
      ) : (
        <>
          <SkeletonPlayerLabelSection />
          <SkeletonInPlaySection inverted={inverted} />
          <SkeletonHandAndDeckGrid />
        </>
      )}
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
  const gameLogHeight = getStoredLogHeight();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background:
          "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
        borderInlineStart: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: `${gameLogHeight}%`,
          flex: "none",
          minBlockSize: 0,
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
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
          background: "var(--color-border)",
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "3px",
            background: "var(--color-text-secondary)",
            borderRadius: "2px",
            opacity: 0.5,
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
