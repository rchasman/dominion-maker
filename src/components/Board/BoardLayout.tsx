import type { ComponentChildren } from "preact";
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
  /** Only a game with history scrubbing has a preview mode */
  isPreviewMode?: boolean;
  previewError?: string | null;
  children: ComponentChildren;
}

export function BoardLayout({
  isPreviewMode = false,
  previewError = null,
  children,
}: BoardLayoutProps) {
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
          {previewError
            ? `⏸ PREVIEW MODE - ${previewError}`
            : "⏸ PREVIEW MODE - Scrubbing through history"}
        </div>
      )}
      {children}
    </div>
  );
}

interface GameAreaLayoutProps {
  isPreviewMode?: boolean;
  /**
   * "fill" spreads every row across the area. "center" sizes the area to its
   * widest row and centres the lot, so a board held to a square keeps the rows
   * above and below it at its own width instead of letting them run wide.
   */
  align?: "fill" | "center";
  children: ComponentChildren;
}

export function GameAreaLayout({
  isPreviewMode = false,
  align = "fill",
  children,
}: GameAreaLayoutProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        ...(align === "center" && {
          gridTemplateColumns: "minmax(0, auto)",
          justifyContent: "center",
        }),
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
