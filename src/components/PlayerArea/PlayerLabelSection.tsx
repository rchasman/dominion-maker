import { useState } from "preact/hooks";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  useClientPoint,
} from "@floating-ui/react";
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
  floatingStyles: React.CSSProperties;
  playerColor: string;
  label: string;
  playerStrategy: { gameplan: string; read: string; recommendation: string };
  setFloating: (node: HTMLElement | null) => void;
  getFloatingProps: () => Record<string, unknown>;
}) {
  const {
    floatingStyles,
    playerColor,
    label,
    playerStrategy,
    setFloating,
    getFloatingProps,
  } = params;

  return (
    <div
      ref={setFloating}
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
      {...getFloatingProps()}
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

function useStrategyFloating(initialOpen = false) {
  const [isStrategyOpen, setIsStrategyOpen] = useState(initialOpen);

  const { refs, floatingStyles, context } = useFloating({
    open: isStrategyOpen,
    onOpenChange: setIsStrategyOpen,
    placement: "top-end",
    middleware: [
      offset({ mainAxis: 8, crossAxis: 8 }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const setReference = (node: HTMLElement | null) => refs.setReference(node);
  const setFloating = (node: HTMLElement | null) => refs.setFloating(node);

  const hover = useHover(context);
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const clientPoint = useClientPoint(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
    clientPoint,
  ]);

  return {
    isStrategyOpen,
    floatingStyles,
    setReference,
    setFloating,
    getReferenceProps,
    getFloatingProps,
  };
}

export function PlayerLabelSection({
  label,
  playerId,
  loading,
  playerStrategy,
  vpCount,
}: PlayerLabelSectionProps) {
  const hasStrategyContent =
    playerStrategy &&
    (playerStrategy.gameplan ||
      playerStrategy.read ||
      playerStrategy.recommendation);

  const {
    isStrategyOpen,
    floatingStyles,
    setReference,
    setFloating,
    getReferenceProps,
    getFloatingProps,
  } = useStrategyFloating();

  const playerColor = playerId ? getPlayerColor(playerId) : "rgb(205 133 63)";

  const labelColor = playerId
    ? getPlayerColor(playerId)
    : "var(--color-text-primary)";

  return (
    <div
      style={{
        marginBlockEnd: "var(--space-1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        {loading ? (
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-tertiary)",
            }}
          >
            Reconnecting...
          </span>
        ) : (
          <>
            <strong
              ref={setReference}
              {...(hasStrategyContent ? getReferenceProps() : {})}
              style={{
                fontSize: "0.8125rem",
                color: labelColor,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                cursor: hasStrategyContent ? "help" : "default",
              }}
            >
              {label}
              {hasStrategyContent && (
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
            {isStrategyOpen &&
              hasStrategyContent &&
              playerStrategy &&
              renderStrategyTooltip({
                floatingStyles,
                playerColor,
                label,
                playerStrategy,
                setFloating,
                getFloatingProps,
              })}
          </>
        )}
      </div>
      {vpCount !== undefined && (
        <div
          style={{
            fontSize: "0.875rem",
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
          {loading ? (
            <div
              style={{
                width: "24px",
                height: "16px",
                background: "var(--color-bg-secondary)",
                borderRadius: "4px",
                opacity: 0.5,
              }}
            />
          ) : (
            vpCount
          )}
        </div>
      )}
    </div>
  );
}
