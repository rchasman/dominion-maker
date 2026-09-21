import {
  describeMove,
  eventPhrase,
  type ChessMoveAction,
  type ChessMoveEvent,
  type DescribedMove,
  type PieceName,
} from "./describe-move";
import { playerLabel } from "./names";
import { replayMoves } from "./replay";
import type { ChessState } from "./shape";

/** Each side keeps the colour of the squares it plays, on the board and off it */
export const SIDE_COLORS = ["#e8d3ad", "#c9a875"] as const;

const EVENT_COLORS: Record<ChessMoveEvent["kind"], string> = {
  capture: "#ef4444",
  "en-passant": "#a855f7",
  promotion: "#22c55e",
  check: "#f59e0b",
  checkmate: "#ef4444",
};

/** Each piece keeps one colour wherever the log names it */
const PIECE_COLORS: Record<PieceName, string> = {
  Pawn: "#a3a3a3",
  Knight: "#22c55e",
  Bishop: "#14b8a6",
  Rook: "#3b82f6",
  Queen: "#a855f7",
  King: "var(--color-gold)",
};

const CASTLE_COLOR = "#3b82f6";

type LogRow = {
  ply: number;
  side: "w" | "b";
  player: string;
  san: string;
  /** Null when the log does not replay and only the SAN can be shown */
  described: DescribedMove | null;
};

/** `12.` is White's twelfth move and `12…` is Black's reply, as in print */
const moveLabel = (ply: number): string =>
  `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"}`;

/** A log no engine produced still lists its SAN, with nothing to say about it */
const logRows = (
  state: ChessState,
  playerNames: Record<string, string>,
): LogRow[] => {
  const replayed = replayMoves(state.moves);
  return state.moves.map((san, ply) => {
    const move = replayed?.[ply];
    const side = ply % 2 === 0 ? "w" : "b";
    const playerId = state.playerOrder[side === "w" ? 0 : 1];
    return {
      ply,
      side,
      player: playerLabel(state.playerOrder, playerNames, playerId),
      san,
      described: move === undefined ? null : describeMove(move),
    };
  });
};

type PartKind = "player" | "verb" | "piece" | "square" | "san";

function Part({
  kind,
  color,
  italic = false,
  bold = true,
  children,
}: {
  kind: PartKind;
  color: string;
  italic?: boolean;
  bold?: boolean;
  children: string;
}) {
  return (
    <span
      data-log-part={kind}
      style={{
        color,
        fontWeight: bold ? 600 : 400,
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {children}
    </span>
  );
}

function Verb({
  color = "var(--color-text-primary)",
  bold = false,
  children,
}: {
  color?: string;
  bold?: boolean;
  children: string;
}) {
  return (
    <Part kind="verb" color={color} italic bold={bold}>
      {children}
    </Part>
  );
}

function PieceNoun({ piece }: { piece: PieceName }) {
  return (
    <Part kind="piece" color={PIECE_COLORS[piece]}>
      {piece}
    </Part>
  );
}

function ActionWords({ action }: { action: ChessMoveAction }) {
  if (action.kind === "castle") {
    return <Verb color={CASTLE_COLOR}>{`castles ${action.side}`}</Verb>;
  }
  return (
    <>
      <Verb>moves</Verb> <PieceNoun piece={action.piece} /> to{" "}
      <Part kind="square" color="var(--color-text-primary)" bold={false}>
        {action.to}
      </Part>
    </>
  );
}

function EventWords({ event }: { event: ChessMoveEvent }) {
  const phrase = eventPhrase(event);
  return (
    <>
      <Verb color={EVENT_COLORS[event.kind]} bold={event.kind === "checkmate"}>
        {phrase.verb}
      </Verb>
      {phrase.noun !== null && (
        <>
          {" "}
          <PieceNoun piece={phrase.noun} />
        </>
      )}
    </>
  );
}

/**
 * One row per move, read as Dominion reads a play: the player, an italic
 * verb, the coloured noun it acts on, with each further event nested beneath.
 */
export function ChessLogRows({
  state,
  playerNames = {},
}: {
  state: ChessState;
  playerNames?: Record<string, string>;
}) {
  return (
    <>
      {logRows(state, playerNames).map(row => (
        <div
          key={row.ply}
          data-chess-ply={row.ply}
          style={{
            fontFamily: "monospace",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
            lineHeight: 1.4,
            whiteSpace: "pre",
          }}
        >
          <div>
            <span style={{ opacity: 0.6 }}>{moveLabel(row.ply)} </span>
            <Part kind="player" color={SIDE_COLORS[row.side === "w" ? 0 : 1]}>
              {row.player}
            </Part>{" "}
            {row.described === null ? (
              row.san
            ) : (
              <>
                <ActionWords action={row.described.action} />{" "}
                <Part
                  kind="san"
                  color="var(--color-text-secondary)"
                  bold={false}
                >
                  {`(${row.san})`}
                </Part>
              </>
            )}
          </div>
          {(row.described?.events ?? []).map((event, index, events) => (
            <div key={event.kind} data-chess-event={event.kind}>
              <span
                style={{ color: "var(--color-border)", userSelect: "none" }}
              >
                {index === events.length - 1 ? "└─ " : "├─ "}
              </span>
              <EventWords event={event} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
