import { useEffect, useRef, useState } from "preact/hooks";
import type { CardName } from "../types/game-state";
import { getCardImageUrl, getCardImageFallbackUrl } from "../data/cards";
import type { Zone } from "./types";
import {
  getOptimizedImageUrl,
  generateSrcSet,
} from "../lib/image-optimization";

interface GhostCardProps {
  cardName: CardName;
  fromRect: DOMRect;
  toZone: Zone;
  duration: number;
  getZoneRect: (zone: Zone) => DOMRect | null;
  onComplete: () => void;
}

const ZONE_SCALE: Record<Zone, number> = {
  hand: 1,
  "hand-opponent": 1,
  inPlay: 0.625, // small/large ratio
  "inPlay-opponent": 0.625,
  deck: 0.76, // medium/large ratio
  "deck-opponent": 0.76,
  discard: 0.76,
  "discard-opponent": 0.76,
  supply: 1,
  trash: 0.76,
};

export function GhostCard({
  cardName,
  fromRect,
  toZone,
  duration,
  getZoneRect,
  onComplete,
}: GhostCardProps) {
  const ghostRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"flying" | "done">("flying");

  useEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;

    const toRect = getZoneRect(toZone);
    if (!toRect) {
      // No destination found, just fade out
      onComplete();
      return;
    }

    // Calculate center-to-center translation
    const fromCenterX = fromRect.left + fromRect.width / 2;
    const fromCenterY = fromRect.top + fromRect.height / 2;
    const toCenterX = toRect.left + toRect.width / 2;
    const toCenterY = toRect.top + toRect.height / 2;

    const deltaX = toCenterX - fromCenterX;
    const deltaY = toCenterY - fromCenterY;
    const scale = ZONE_SCALE[toZone];

    // Use Web Animations API for smooth animation
    const animation = ghost.animate(
      [
        {
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
        },
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
          opacity: 0.8,
        },
      ],
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      },
    );

    animation.onfinish = () => {
      setPhase("done");
      onComplete();
    };

    return () => animation.cancel();
  }, [fromRect, toZone, duration, getZoneRect, onComplete]);

  if (phase === "done") return null;

  const imageUrl = getCardImageUrl(cardName);
  const fallbackUrl = getCardImageFallbackUrl(cardName);

  return (
    <div
      ref={ghostRef}
      style={{
        position: "fixed",
        left: fromRect.left,
        top: fromRect.top,
        width: fromRect.width,
        height: fromRect.height,
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform, opacity",
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={generateSrcSet(imageUrl, [200, 300, 400, 600])}
          sizes={`${fromRect.width}px`}
        />
        <source
          type="image/jpeg"
          srcSet={generateSrcSet(fallbackUrl, [200, 300, 400, 600])}
          sizes={`${fromRect.width}px`}
        />
        <img
          src={getOptimizedImageUrl({ url: imageUrl, width: 400 })}
          alt={cardName}
          width="200"
          height="320"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: "4px",
            boxShadow: "0 6px 25px rgba(0, 0, 0, 0.5)",
          }}
        />
      </picture>
    </div>
  );
}
