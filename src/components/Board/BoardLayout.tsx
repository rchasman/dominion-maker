import type { ReactNode } from "preact/compat";
import {
  GRID_TEMPLATE_COLUMNS,
  PREVIEW_INDICATOR_TOP,
  PREVIEW_INDICATOR_LEFT,
  PREVIEW_INDICATOR_RIGHT,
  PREVIEW_INDICATOR_Z_INDEX,
  PREVIEW_BACKGROUND,
  PREVIEW_BORDER_COLOR,
  PREVIEW_BORDER_WIDTH,
  PREVIEW_TEXT_COLOR,
  PREVIEW_FONT_SIZE,
  PREVIEW_FONT_WEIGHT,
  PREVIEW_PADDING_OFFSET,
} from "./constants";

interface BoardLayoutProps {
  isPreviewMode: boolean;
  children: ReactNode;
}

export function BoardLayout({ isPreviewMode, children }: BoardLayoutProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
        inlineSize: "100vw",
        blockSize: "100dvh",
        overflow: "hidden",
        background: "var(--color-bg-primary)",
        position: "relative",
      }}
    >
      {isPreviewMode && (
        <div
          style={{
            position: "absolute",
            top: PREVIEW_INDICATOR_TOP,
            left: PREVIEW_INDICATOR_LEFT,
            right: PREVIEW_INDICATOR_RIGHT,
            background: PREVIEW_BACKGROUND,
            color: PREVIEW_TEXT_COLOR,
            padding: "var(--space-3)",
            textAlign: "center",
            fontWeight: PREVIEW_FONT_WEIGHT,
            fontSize: PREVIEW_FONT_SIZE,
            zIndex: PREVIEW_INDICATOR_Z_INDEX,
            borderBottom: `${PREVIEW_BORDER_WIDTH} solid ${PREVIEW_BORDER_COLOR}`,
          }}
        >
          ⏸ PREVIEW MODE - Scrubbing through history
        </div>
      )}
      {children}
    </div>
  );
}

interface GameAreaLayoutProps {
  isPreviewMode: boolean;
  children: ReactNode;
}

export function GameAreaLayout({
  isPreviewMode,
  children,
}: GameAreaLayoutProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        rowGap: "var(--space-2)",
        padding: "var(--space-3)",
        minInlineSize: 0,
        overflow: "hidden",
        paddingTop: isPreviewMode
          ? `calc(var(--space-3) + ${PREVIEW_PADDING_OFFSET})`
          : "var(--space-3)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
