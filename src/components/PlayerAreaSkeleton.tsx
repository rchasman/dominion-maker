/**
 * PlayerAreaSkeleton - Loading placeholder that matches PlayerArea layout
 * Prevents layout shift during reconnection
 */

export function PlayerAreaSkeleton() {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        border: "2px solid var(--color-border)",
        background: "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
      }}
    >
      {/* Header */}
      <div style={{
        marginBlockEnd: "var(--space-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <strong style={{
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          opacity: 0.5,
        }}>
          You
        </strong>
        <div style={{
          fontSize: "0.875rem",
          color: "var(--color-text-tertiary)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>VP:</span>
          <div
            style={{
              width: "24px",
              height: "16px",
              background: "var(--color-bg-secondary)",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>

      {/* In Play area */}
      <div style={{
        position: "relative",
        padding: "var(--space-3)",
        marginBlockEnd: "var(--space-3)",
        background: "rgb(255 255 255 / 0.02)",
        border: "1px dashed var(--color-border)",
        minBlockSize: "calc(var(--card-height-small) + var(--space-6))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          position: "absolute",
          insetBlockStart: "var(--space-1)",
          insetInlineStart: "var(--space-2)",
          fontSize: "0.5625rem",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          fontWeight: 600
        }}>
          In Play (empty)
        </div>
        <div style={{
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary)",
        }}>
          Reconnecting...
        </div>
      </div>

      {/* Hand + Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "75% 25%", gap: "var(--space-3)" }}>
        {/* Hand skeleton */}
        <div style={{
          position: "relative",
          padding: "var(--space-2)",
          background: "rgb(255 255 255 / 0.05)",
          border: "1px solid var(--color-border)",
          minHeight: "120px",
        }}>
          <div style={{
            position: "absolute",
            insetBlockStart: "var(--space-1)",
            insetInlineStart: "var(--space-2)",
            fontSize: "0.5625rem",
            color: "var(--color-text-muted)",
            fontWeight: 600,
            textTransform: "uppercase"
          }}>
            Hand
          </div>
          <div style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            paddingTop: "var(--space-4)",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100px",
          }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: "var(--card-width-medium)",
                  height: "var(--card-height-medium)",
                  background: "linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%)",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  opacity: 0.4,
                  animation: `pulse 2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Stats skeleton */}
        <div style={{
          padding: "var(--space-2)",
          background: "rgb(255 255 255 / 0.03)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}>
          {[
            { label: "Deck", icon: "🂠" },
            { label: "Discard", icon: "🗑" },
            { label: "Hand", icon: "🃏" }
          ].map(({ label, icon }) => (
            <div key={label}>
              <div style={{
                fontSize: "0.625rem",
                color: "var(--color-text-tertiary)",
                marginBottom: "var(--space-1)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {icon} {label}
              </div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
              }}>
                <div
                  style={{
                    width: "32px",
                    height: "20px",
                    background: "var(--color-bg-secondary)",
                    borderRadius: "4px",
                    opacity: 0.5,
                  }}
                />
                <span style={{
                  fontSize: "0.625rem",
                  color: "var(--color-text-muted)",
                }}>
                  cards
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
