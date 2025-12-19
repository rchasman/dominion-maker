import { useEffect, useRef } from "preact/hooks";
import type { CardName } from "../../types/game-state";
import { Card } from "../Card";
import { CARDS } from "../../data/cards";
import { useAnimationSafe } from "../../animation";

interface InPlaySectionProps {
  inPlay: CardName[];
  loading: boolean;
  hasMadePurchases: boolean;
  onInPlayClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}

export function InPlaySection({
  inPlay,
  loading,
  hasMadePurchases,
  onInPlayClick,
  inverted = false,
}: InPlaySectionProps) {
  const animation = useAnimationSafe();
  const containerRef = useRef<HTMLDivElement>(null);

  // Register with player-specific zone name
  useEffect(() => {
    if (animation && containerRef.current) {
      const zoneName = inverted ? "inPlay-opponent" : "inPlay";
      animation.registerZoneRef(zoneName, containerRef.current);
      return () => animation.registerZoneRef(zoneName, null);
    }
  }, [animation, inverted]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        padding: "var(--space-2)",
        marginBlockStart: inverted ? "var(--space-2)" : undefined,
        marginBlockEnd: inverted ? undefined : "var(--space-2)",
        background:
          inPlay.length > 0
            ? "rgb(255 255 255 / 0.05)"
            : "rgb(255 255 255 / 0.02)",
        border:
          inPlay.length > 0
            ? "1px solid var(--color-border)"
            : "1px dashed var(--color-border)",
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
        }}
      >
        In Play {inPlay.length === 0 && "(empty)"}
      </div>
      <div
        style={{
          display: "flex",
          gap: "var(--space-1)",
          flexWrap: "wrap",
          minBlockSize: "100%",
          justifyContent: "center",
          alignItems: "center",
          alignContent: "center",
          minInlineSize: 0,
        }}
      >
        {!loading &&
          inPlay.map((card, i) => {
            const isTreasure = CARDS[card]?.types.includes("treasure");
            const suffix = inverted ? "-opponent" : "";
            return (
              <Card
                key={`${card}-${i}`}
                name={card}
                size="small"
                cardId={`inPlay${suffix}-${i}-${card}`}
                {...(onInPlayClick !== undefined && {
                  onClick: () => onInPlayClick(card, i),
                })}
                dimmed={isTreasure && hasMadePurchases}
              />
            );
          })}
      </div>
    </div>
  );
}
