import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { Card } from "../Card";
import { DEFAULT_LOG_HEIGHT_PERCENT } from "./constants";

const STORAGE_LOG_HEIGHT_KEY = "dominion-maker-log-height";
const STORAGE_GAME_MODE_KEY = "dominion-maker-game-mode";

type GameMode = "engine" | "hybrid" | "full";

function getStoredLogHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_LOG_HEIGHT_KEY);
    return saved ? parseFloat(saved) : DEFAULT_LOG_HEIGHT_PERCENT;
  } catch {
    return DEFAULT_LOG_HEIGHT_PERCENT;
  }
}

function getStoredGameMode(): GameMode {
  try {
    const savedModeRaw = localStorage.getItem(STORAGE_GAME_MODE_KEY);
    if (!savedModeRaw) return "engine";
    const savedMode = JSON.parse(savedModeRaw) as string;
    if (savedMode === "engine" || savedMode === "hybrid" || savedMode === "full") {
      return savedMode;
    }
  } catch {
    // Invalid JSON or storage error
  }
  return "engine";
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

function SkeletonPlayerLabelSection({ inverted }: { inverted: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        paddingBlock: "var(--space-1)",
      }}
    >
      <strong
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        {inverted ? "ai" : "You"}
      </strong>
      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-border)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            fontWeight: 400,
            fontSize: "0.75rem",
          }}
        >
          VP:
        </span>
        0
      </div>
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--color-border)",
          marginLeft: "auto",
        }}
      >
        Actions:{" "}
        <strong
          style={{
            color: "var(--color-border)",
            fontWeight: 700,
          }}
        >
          -
        </strong>
      </span>
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--color-border)",
        }}
      >
        Buys:{" "}
        <strong
          style={{
            color: "var(--color-border)",
            fontWeight: 700,
          }}
        >
          -
        </strong>
      </span>
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--color-border)",
        }}
      >
        Coins:{" "}
        <strong
          style={{
            color: "var(--color-border)",
            fontWeight: 700,
          }}
        >
          -
        </strong>
      </span>
      <span
        style={{
          textTransform: "uppercase",
          color: "var(--color-border)",
          fontSize: "0.625rem",
          background: "transparent",
          border: "1px dashed var(--color-border)",
          padding: "var(--space-1) var(--space-2)",
          fontWeight: 600,
          minWidth: "4.5rem",
          textAlign: "center",
        }}
      >
        waiting
      </span>
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
          <SkeletonPlayerLabelSection inverted={inverted} />
        </>
      ) : (
        <>
          <SkeletonPlayerLabelSection inverted={inverted} />
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

      <div style={{ gridArea: "kingdom", minInlineSize: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0, var(--card-width-large)))",
            justifyContent: "center",
            marginBlockEnd: "var(--space-2)",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              color: "var(--color-text-primary)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Kingdom
          </div>
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
  const gameMode = getStoredGameMode();

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
          overflow: "hidden",
        }}
      >
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
            }}
          >
            Game Log
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minBlockSize: 0,
            padding: "var(--space-5)",
            paddingBlockStart: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            overflow: "hidden",
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
          background: "var(--color-bg-primary)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontFamily: "monospace",
            overflow: "hidden",
          }}
        >
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
                <button
                  disabled
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-secondary)",
                    cursor: "default",
                    fontSize: "0.875rem",
                    fontWeight: 400,
                    fontFamily: "inherit",
                    padding: "var(--space-2)",
                    minWidth: "24px",
                    minHeight: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⚙
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <button
                    disabled
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      padding: "var(--space-2)",
                      minWidth: "24px",
                      minHeight: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-secondary)",
                      cursor: "default",
                      opacity: 0.3,
                    }}
                  >
                    ↶
                  </button>
                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontWeight: 400,
                    }}
                  >
                    Turn 1 of 1
                  </span>
                  <button
                    disabled
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      padding: "var(--space-2)",
                      minWidth: "24px",
                      minHeight: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-secondary)",
                      cursor: "default",
                      opacity: 0.3,
                    }}
                  >
                    ↷
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minBlockSize: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                minBlockSize: 0,
                padding: "var(--space-5)",
                paddingBlockStart: "var(--space-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                overflow: "hidden",
              }}
            >
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
        </div>
      </div>

      <div
        style={{
          padding: "var(--space-4)",
          borderBlockStart: "1px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ marginBlockEnd: "var(--space-3)" }}>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05rem",
              }}
            >
              Mode:
            </span>
            {(["Engine", "Hybrid", "Full"] as const).map((modeName) => {
              const isSelected = modeName.toLowerCase() === gameMode;
              return (
                <button
                  key={modeName}
                  disabled
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.65rem",
                    fontWeight: isSelected ? 700 : 400,
                    background: isSelected ? "var(--color-victory-dark)" : "transparent",
                    color: isSelected ? "#fff" : "var(--color-text-secondary)",
                    border: "1px solid",
                    borderColor: isSelected ? "var(--color-victory)" : "var(--color-border-secondary)",
                    cursor: "default",
                    textTransform: "uppercase",
                    letterSpacing: "0.05rem",
                    fontFamily: "inherit",
                    borderRadius: "3px",
                  }}
                >
                  {modeName}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            justifyContent: "center",
          }}
        >
          <button
            disabled
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              cursor: "default",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-1)",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>⊕</span>
            <span>New Game</span>
          </button>
          <button
            disabled
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              cursor: "default",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              borderRadius: "4px",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-1)",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>⊗</span>
            <span>End Game</span>
          </button>
        </div>
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
