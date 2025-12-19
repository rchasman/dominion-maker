import { useEffect, useRef, useState } from "preact/hooks";
import type { CardName } from "../types/game-state";
import { getCardImageUrl, getCardImageFallbackUrl } from "../data/card-urls";
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

// Constants for center calculations
const CENTER_DIVISOR = 2;

// Image optimization constants
const SRCSET_WIDTH_200 = 200;
const SRCSET_WIDTH_300 = 300;
const SRCSET_WIDTH_400 = 400;
const SRCSET_WIDTH_600 = 600;
const SRCSET_WIDTHS = [
  SRCSET_WIDTH_200,
  SRCSET_WIDTH_300,
  SRCSET_WIDTH_400,
  SRCSET_WIDTH_600,
];
const DEFAULT_IMAGE_WIDTH = SRCSET_WIDTH_400;
const CARD_IMAGE_WIDTH = "200";
const CARD_IMAGE_HEIGHT = "320";
const CARD_BORDER_RADIUS = "4px";
const CARD_SHADOW_BLUR = "25px";
const CARD_SHADOW_OFFSET = "6px";
const GHOST_Z_INDEX = 9999;

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
      console.warn(
        `[GhostCard] Zone rect not found for: ${toZone}, card: ${cardName}`,
      );
      onComplete();
      return;
    }

    // Calculate center-to-center translation
    const fromCenterX = fromRect.left + fromRect.width / CENTER_DIVISOR;
    const fromCenterY = fromRect.top + fromRect.height / CENTER_DIVISOR;
    const toCenterX = toRect.left + toRect.width / CENTER_DIVISOR;
    const toCenterY = toRect.top + toRect.height / CENTER_DIVISOR;

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
  }, [cardName, fromRect, toZone, duration, getZoneRect, onComplete]);

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
        zIndex: GHOST_Z_INDEX,
        willChange: "transform, opacity",
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={generateSrcSet(imageUrl, SRCSET_WIDTHS)}
          sizes={`${fromRect.width}px`}
        />
        <source
          type="image/jpeg"
          srcSet={generateSrcSet(fallbackUrl, SRCSET_WIDTHS)}
          sizes={`${fromRect.width}px`}
        />
        <img
          src={getOptimizedImageUrl({
            url: imageUrl,
            width: DEFAULT_IMAGE_WIDTH,
          })}
          alt={cardName}
          width={CARD_IMAGE_WIDTH}
          height={CARD_IMAGE_HEIGHT}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: CARD_BORDER_RADIUS,
            boxShadow: `0 ${CARD_SHADOW_OFFSET} ${CARD_SHADOW_BLUR} rgba(0, 0, 0, 0.5)`,
          }}
        />
      </picture>
    </div>
  );
}
