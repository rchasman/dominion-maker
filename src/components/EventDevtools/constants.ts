const PADDING_SMALL = 2;
const PADDING_MEDIUM = 4;
const PADDING_LARGE = 6;
const PADDING_EXTRA_LARGE = 8;
const PADDING_XXL = 12;
const PADDING_XXXL = 16;

const BORDER_RADIUS_SMALL = 3;
const BORDER_RADIUS_MEDIUM = 4;
const BORDER_RADIUS_LARGE = 8;
const BORDER_RADIUS_XL = 10;

const FONT_SIZE_TINY = 10;
const FONT_SIZE_SMALL = 11;
const FONT_SIZE_REGULAR = 12;
const FONT_SIZE_MEDIUM = 14;
const FONT_SIZE_LARGE = 16;

const OPACITY_DISABLED = 0.3;

const Z_INDEX_DEVTOOLS = 9999;

const BORDER_WIDTH_THIN = 1;
const BORDER_WIDTH_MEDIUM = 3;

const MIN_WIDTH_SMALL = 50;
const MIN_WIDTH_MEDIUM = 100;
const MIN_WIDTH_LARGE = 140;

const CONTAINER_WIDTH = 450;
const CONTAINER_HEIGHT_VH = 80;
const CONTAINER_BOTTOM = 16;
const CONTAINER_LEFT = 16;

const SLIDER_HEIGHT = 4;

export const styles = {
  container: {
    position: "fixed",
    bottom: `${CONTAINER_BOTTOM}px`,
    left: `${CONTAINER_LEFT}px`,
    width: `${CONTAINER_WIDTH}px`,
    height: `${CONTAINER_HEIGHT_VH}vh`,
    background: "rgba(26, 26, 46, 0.92)",
    backdropFilter: "blur(16px)",
    border: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    borderRadius: `${BORDER_RADIUS_LARGE}px`,
    display: "flex",
    flexDirection: "column",
    fontFamily: "ui-monospace, monospace",
    fontSize: `${FONT_SIZE_REGULAR}px`,
    zIndex: Z_INDEX_DEVTOOLS,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  toggleButton: {
    position: "fixed",
    bottom: `${CONTAINER_BOTTOM}px`,
    left: `${CONTAINER_LEFT}px`,
    display: "flex",
    alignItems: "center",
    gap: `${PADDING_EXTRA_LARGE}px`,
    padding: `${PADDING_EXTRA_LARGE}px ${PADDING_XXL}px`,
    background: "#1a1a2e",
    border: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    borderRadius: `${BORDER_RADIUS_LARGE}px`,
    color: "#a0a0b0",
    cursor: "pointer",
    fontFamily: "ui-monospace, monospace",
    fontSize: `${FONT_SIZE_REGULAR}px`,
    zIndex: Z_INDEX_DEVTOOLS,
  },
  toggleIcon: {
    color: "#6366f1",
  },
  eventCount: {
    background: "#6366f1",
    color: "white",
    padding: `${PADDING_SMALL}px ${PADDING_LARGE}px`,
    borderRadius: `${BORDER_RADIUS_XL}px`,
    fontSize: `${FONT_SIZE_TINY}px`,
  },
  replayBadge: {
    background: "#f59e0b",
    color: "white",
    padding: `${PADDING_SMALL}px ${PADDING_LARGE}px`,
    borderRadius: `${BORDER_RADIUS_XL}px`,
    fontSize: `${FONT_SIZE_TINY}px`,
  },
  scrubber: {
    padding: `${PADDING_EXTRA_LARGE}px ${PADDING_XXL}px`,
    borderBottom: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    background: "#16162a",
  },
  scrubberControls: {
    display: "flex",
    alignItems: "center",
    gap: `${PADDING_EXTRA_LARGE}px`,
  },
  scrubberButton: {
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "transparent",
    border: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    borderRadius: `${BORDER_RADIUS_MEDIUM}px`,
    color: "#a0a0b0",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_MEDIUM}px`,
    lineHeight: 1,
    transition: "all 0.15s",
  },
  liveButtonInline: {
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "#22c55e",
    border: "none",
    borderRadius: `${BORDER_RADIUS_MEDIUM}px`,
    color: "white",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_MEDIUM}px`,
    lineHeight: 1,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  scrubberSliderContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: `${PADDING_MEDIUM}px`,
  },
  scrubberInput: {
    width: "100%",
    height: `${SLIDER_HEIGHT}px`,
    background: "#2d2d44",
    outline: "none",
    borderRadius: `${PADDING_SMALL}px`,
    cursor: "pointer",
  },
  scrubberLabel: {
    fontSize: `${FONT_SIZE_TINY}px`,
    color: "#a0a0b0",
    textAlign: "center",
  },
  inlineBranchButton: {
    marginLeft: "auto",
    padding: `${PADDING_SMALL}px ${PADDING_LARGE}px`,
    background: "rgba(34, 197, 94, 0.2)",
    border: `${BORDER_WIDTH_THIN}px solid rgba(34, 197, 94, 0.5)`,
    borderRadius: `${BORDER_RADIUS_SMALL}px`,
    color: "#22c55e",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_MEDIUM}px`,
    lineHeight: 1,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  playhead: {
    marginLeft: "auto",
    color: "#6366f1",
    fontSize: `${FONT_SIZE_REGULAR}px`,
    fontWeight: "bold",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${PADDING_EXTRA_LARGE}px ${PADDING_XXL}px`,
    borderBottom: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    background: "#16162a",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: `${PADDING_EXTRA_LARGE}px`,
    color: "#e0e0e8",
    fontWeight: 600,
  },
  titleIcon: {
    color: "#6366f1",
  },
  badge: {
    background: "#6366f1",
    color: "white",
    padding: `${PADDING_SMALL}px ${PADDING_LARGE}px`,
    borderRadius: `${BORDER_RADIUS_XL}px`,
    fontSize: `${FONT_SIZE_TINY}px`,
  },
  headerActions: {
    display: "flex",
    gap: `${PADDING_MEDIUM}px`,
  },
  headerButton: {
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "transparent",
    border: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    borderRadius: `${BORDER_RADIUS_MEDIUM}px`,
    color: "#a0a0b0",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_SMALL}px`,
  },
  closeButton: {
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "transparent",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_LARGE}px`,
  },
  filters: {
    display: "flex",
    gap: `${PADDING_MEDIUM}px`,
    padding: `${PADDING_EXTRA_LARGE}px`,
    borderBottom: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
  },
  filterButton: {
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "transparent",
    border: `${BORDER_WIDTH_THIN}px solid transparent`,
    borderRadius: `${BORDER_RADIUS_MEDIUM}px`,
    color: "#a0a0b0",
    cursor: "pointer",
    fontSize: `${FONT_SIZE_SMALL}px`,
    textTransform: "capitalize",
  },
  eventList: {
    flex: 1,
    overflowY: "scroll",
    overflowX: "auto",
    minHeight: 0,
  },
  eventItem: {
    display: "flex",
    gap: `${PADDING_EXTRA_LARGE}px`,
    padding: `${PADDING_LARGE}px ${PADDING_XXL}px`,
    borderLeft: `${BORDER_WIDTH_MEDIUM}px solid`,
    cursor: "pointer",
    alignItems: "center",
    minWidth: "fit-content",
  },
  eventId: {
    color: "#6b7280",
    minWidth: `${MIN_WIDTH_SMALL}px`,
    fontSize: `${FONT_SIZE_TINY}px`,
    fontFamily: "monospace",
  },
  causalArrow: {
    marginRight: `${PADDING_MEDIUM}px`,
    color: "var(--color-text-tertiary)",
    fontSize: "0.75rem",
  },
  eventType: {
    fontWeight: 600,
    minWidth: `${MIN_WIDTH_LARGE}px`,
    fontSize: `${FONT_SIZE_TINY}px`,
  },
  eventDetail: {
    color: "#a0a0b0",
    whiteSpace: "nowrap",
  },
  inspector: {
    borderTop: `${BORDER_WIDTH_THIN}px solid #2d2d44`,
    flex: "0 1 50%",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${PADDING_EXTRA_LARGE}px ${PADDING_XXL}px`,
    background: "#16162a",
    color: "#a0a0b0",
  },
  stateView: {
    flex: 1,
    overflowY: "scroll",
    padding: `${PADDING_EXTRA_LARGE}px`,
  },
  stateJson: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#e0e0e8",
  },
  diffContent: {
    display: "flex",
    flexDirection: "column",
    gap: `${PADDING_MEDIUM}px`,
  },
  diffRow: {
    display: "flex",
    alignItems: "center",
    gap: `${PADDING_EXTRA_LARGE}px`,
    padding: `${PADDING_MEDIUM}px ${PADDING_EXTRA_LARGE}px`,
    background: "#16162a",
    borderRadius: `${BORDER_RADIUS_MEDIUM}px`,
  },
  diffPath: {
    color: "#6366f1",
    minWidth: `${MIN_WIDTH_MEDIUM}px`,
  },
  diffFrom: {
    color: "#ef4444",
    textDecoration: "line-through",
  },
  diffArrow: {
    color: "#6b7280",
  },
  diffTo: {
    color: "#22c55e",
  },
  noChanges: {
    color: "#6b7280",
    textAlign: "center",
    padding: `${PADDING_XXXL}px`,
  },
  scrubberButtonDisabled: {
    opacity: OPACITY_DISABLED,
    cursor: "not-allowed",
  },
};
