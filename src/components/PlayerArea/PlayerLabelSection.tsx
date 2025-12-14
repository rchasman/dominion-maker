import { useState, useEffect, useRef } from "preact/hooks";
import {
  computePosition,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/dom";
import { getPlayerColor } from "../../lib/board-utils";

interface PlayerLabelSectionProps {
  label: string;
  playerId?: string;
  loading: boolean;
  playerStrategy?: {
    gameplan: string;
    read: string;
    recommendation: string;
  };
  vpCount?: number;
  phase?: string;
  actions?: number;
  buys?: number;
  coins?: number;
  isActive?: boolean;
}

function renderStrategySection(playerStrategy: {
  gameplan: string;
  read: string;
  recommendation: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            opacity: 0.6,
            marginBottom: "0.25rem",
          }}
        >
          Gameplan
        </div>
        <div>{playerStrategy.gameplan}</div>
      </div>
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            opacity: 0.6,
            marginBottom: "0.25rem",
          }}
        >
          Read
        </div>
        <div style={{ lineHeight: "1.6" }}>{playerStrategy.read}</div>
      </div>
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            opacity: 0.6,
            marginBottom: "0.25rem",
          }}
        >
          Recommendation
        </div>
        <div style={{ lineHeight: "1.6" }}>{playerStrategy.recommendation}</div>
      </div>
    </div>
  );
}

function renderStrategyTooltip(params: {
  floatingStyles: { position: string; top: string; left: string };
  playerColor: string;
  label: string;
  playerStrategy: { gameplan: string; read: string; recommendation: string };
  floatingRef: (node: HTMLElement | null) => void;
}) {
  const { floatingStyles, playerColor, label, playerStrategy, floatingRef } =
    params;

  return (
    <div
      ref={floatingRef}
      style={{
        ...floatingStyles,
        background: "rgba(26, 26, 46, 0.75)",
        backdropFilter: "blur(12px)",
        border: `2px solid ${playerColor}`,
        padding: "1rem",
        maxWidth: "320px",
        zIndex: 10000,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "var(--space-2)",
          left: "var(--space-2)",
          fontSize: "0.625rem",
          color: playerColor,
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        Strategy - {label}
      </div>
      <div
        style={{
          fontSize: "0.8125rem",
          lineHeight: "1.5",
          color: "var(--color-text-primary)",
          paddingTop: "0.75rem",
        }}
      >
        {renderStrategySection(playerStrategy)}
      </div>
    </div>
  );
}

function useStrategyFloating() {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingStyles, setFloatingStyles] = useState({
    position: "absolute" as const,
    top: "0px",
    left: "0px",
  });
  const referenceRef = useRef<HTMLElement | null>(null);
  const floatingRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setReference = (node: HTMLElement | null) => {
    referenceRef.current = node;
  };

  const setFloating = (node: HTMLElement | null) => {
    floatingRef.current = node;
  };

  // Update positioning when open
  useEffect(() => {
    const reference = referenceRef.current;
    const floating = floatingRef.current;

    if (!isOpen || !reference || !floating) {
      return;
    }

    const updatePosition = () => {
      computePosition(reference, floating, {
        placement: "top-end",
        middleware: [
          offset({ mainAxis: 8, crossAxis: 8 }),
          flip(),
          shift({ padding: 8 }),
        ],
      })
        .then(({ x, y }) => {
          setFloatingStyles({
            position: "absolute",
            top: `${y}px`,
            left: `${x}px`,
          });
        })
        .catch(() => {
          // Position calculation failed, tooltip stays hidden
        });
    };

    // Initial position
    updatePosition();

    // Auto-update on scroll/resize
    cleanupRef.current = autoUpdate(reference, floating, updatePosition);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [isOpen]);

  // Handle hover interactions
  useEffect(() => {
    const reference = referenceRef.current;
    if (!reference) {
      return;
    }

    const handleMouseEnter = () => setIsOpen(true);
    const handleMouseLeave = () => setIsOpen(false);
    const handleFocus = () => setIsOpen(true);
    const handleBlur = () => setIsOpen(false);

    reference.addEventListener("mouseenter", handleMouseEnter);
    reference.addEventListener("mouseleave", handleMouseLeave);
    reference.addEventListener("focus", handleFocus);
    reference.addEventListener("blur", handleBlur);

    return () => {
      reference.removeEventListener("mouseenter", handleMouseEnter);
      reference.removeEventListener("mouseleave", handleMouseLeave);
      reference.removeEventListener("focus", handleFocus);
      reference.removeEventListener("blur", handleBlur);
    };
  }, []);

  return {
    isOpen,
    floatingStyles,
    setReference,
    setFloating,
  };
}

function hasStrategyContent(playerStrategy?: {
  gameplan: string;
  read: string;
  recommendation: string;
}): playerStrategy is {
  gameplan: string;
  read: string;
  recommendation: string;
} {
  return !!(
    playerStrategy &&
    (playerStrategy.gameplan ||
      playerStrategy.read ||
      playerStrategy.recommendation)
  );
}

function getStatValue(
  isActive: boolean | undefined,
  value: number | undefined,
): string | number {
  return isActive && value !== undefined ? value : "-";
}

function getStatColor(isActive: boolean | undefined): string {
  return isActive ? "var(--color-text-secondary)" : "var(--color-border)";
}

function getPhaseColor(phase: string): string {
  return phase === "action"
    ? "var(--color-action-phase)"
    : "var(--color-buy-phase)";
}

function getPhaseStyles(isActive: boolean | undefined, phase: string) {
  if (!isActive) {
    return {
      color: "var(--color-border)",
      background: "transparent",
      border: "1px dashed var(--color-border)",
    };
  }

  const phaseColor = getPhaseColor(phase);
  return {
    color: "#fff",
    background: `color-mix(in srgb, ${phaseColor} 30%, transparent)`,
    border: `1px solid color-mix(in srgb, ${phaseColor} 60%, transparent)`,
  };
}

function PlayerLabel({
  label,
  labelColor,
  hasStrategy,
  setReference,
}: {
  label: string;
  labelColor: string;
  hasStrategy: boolean;
  setReference: (node: HTMLElement | null) => void;
}) {
  return (
    <strong
      ref={setReference}
      style={{
        fontSize: "0.8125rem",
        color: labelColor,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        cursor: hasStrategy ? "help" : "default",
      }}
    >
      {label}
      {hasStrategy && (
        <span
          style={{
            fontSize: "0.875rem",
            opacity: 0.7,
            color: "var(--color-info)",
            fontWeight: "normal",
          }}
        >
          ⓘ
        </span>
      )}
    </strong>
  );
}

function VictoryPoints({
  vpCount,
  playerId,
}: {
  vpCount: number;
  playerId?: string;
}) {
  return (
    <div
      style={{
        fontSize: "0.8125rem",
        color: playerId ? getPlayerColor(playerId) : "var(--color-victory)",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontWeight: 400,
          fontSize: "0.75rem",
        }}
      >
        VP:
      </span>
      {vpCount}
    </div>
  );
}

function StatDisplay({
  label,
  value,
  isActive,
  activeColor,
  marginLeft,
}: {
  label: string;
  value: string | number;
  isActive: boolean | undefined;
  activeColor: string;
  marginLeft?: string;
}) {
  return (
    <span
      style={{
        fontSize: "0.75rem",
        color: getStatColor(isActive),
        marginLeft,
      }}
    >
      {label}:{" "}
      <strong
        style={{
          color: isActive ? activeColor : "var(--color-border)",
          fontWeight: 700,
        }}
      >
        {value}
      </strong>
    </span>
  );
}

function PhaseIndicator({
  phase,
  isActive,
}: {
  phase: string;
  isActive: boolean | undefined;
}) {
  const phaseStyles = getPhaseStyles(isActive, phase);

  return (
    <span
      style={{
        textTransform: "uppercase",
        fontSize: "0.625rem",
        padding: "var(--space-1) var(--space-2)",
        fontWeight: 600,
        minWidth: "4.5rem",
        textAlign: "center",
        ...phaseStyles,
      }}
    >
      {isActive ? phase : "waiting"}
    </span>
  );
}

export function PlayerLabelSection({
  label,
  playerId,
  loading,
  playerStrategy,
  vpCount,
  phase,
  actions,
  buys,
  coins,
  isActive,
}: PlayerLabelSectionProps) {
  const hasStrategy = hasStrategyContent(playerStrategy);

  const { isOpen, floatingStyles, setReference, setFloating } =
    useStrategyFloating();

  const playerColor = playerId ? getPlayerColor(playerId) : "rgb(205 133 63)";
  const labelColor = playerId
    ? getPlayerColor(playerId)
    : "var(--color-text-primary)";

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          paddingBlock: "var(--space-1)",
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-tertiary)",
          }}
        >
          Reconnecting...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        paddingBlock: "var(--space-1)",
      }}
    >
      <PlayerLabel
        label={label}
        labelColor={labelColor}
        hasStrategy={hasStrategy}
        setReference={setReference}
      />
      {isOpen &&
        hasStrategy &&
        renderStrategyTooltip({
          floatingStyles,
          playerColor,
          label,
          playerStrategy,
          floatingRef: setFloating,
        })}
      {vpCount !== undefined && (
        <VictoryPoints vpCount={vpCount} playerId={playerId} />
      )}
      <StatDisplay
        label="Actions"
        value={getStatValue(isActive, actions)}
        isActive={isActive}
        activeColor="var(--color-action-phase)"
        marginLeft="auto"
      />
      <StatDisplay
        label="Buys"
        value={getStatValue(isActive, buys)}
        isActive={isActive}
        activeColor="var(--color-buy-phase)"
      />
      <StatDisplay
        label="Coins"
        value={getStatValue(isActive, coins)}
        isActive={isActive}
        activeColor="var(--color-gold-bright)"
      />
      {phase !== undefined && (
        <PhaseIndicator phase={phase} isActive={isActive} />
      )}
    </div>
  );
}
