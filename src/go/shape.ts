/** Go player ids are opaque strings, as everywhere else in the core */
export type GoPlayerId = string;

/** Black first, always: the move count's parity indexes this pair */
export type GoPlayerOrder = [GoPlayerId, GoPlayerId];

export type GoSize = 9 | 13 | 19;

/** The board a table plays on when nobody picks a size: local tables, lobby rooms and the start-screen copy */
export const DEFAULT_GO_SIZE: GoSize = 9;

export type GoGameInitialized = {
  type: "GAME_INITIALIZED";
  players: GoPlayerOrder;
  size: GoSize;
  id?: string | undefined;
};

export type GoStonePlaced = {
  type: "STONE_PLACED";
  playerId: GoPlayerId;
  x: number;
  y: number;
  id?: string | undefined;
};

export type GoPassed = {
  type: "PASSED";
  playerId: GoPlayerId;
  id?: string | undefined;
};

export type GoResigned = {
  type: "RESIGNED";
  playerId: GoPlayerId;
  id?: string | undefined;
};

export type GoEvent = GoGameInitialized | GoStonePlaced | GoPassed | GoResigned;

export type GoCommand =
  | { type: "PLACE"; playerId: GoPlayerId; x: number; y: number }
  | { type: "PASS"; playerId: GoPlayerId }
  | { type: "RESIGN"; playerId: GoPlayerId };

export type GoResult = "score" | "resignation";

/** A played move as the state records it; the mover is its index's parity */
export type GoMoveRecord = { x: number; y: number } | "pass";

export type GoScore = { black: number; white: number };

export type GoState = {
  size: GoSize;
  /** size*size characters, row-major from the top row: "." empty, "B" black, "W" white */
  board: string;
  playerOrder: GoPlayerOrder;
  /** The played moves, in order */
  moves: GoMoveRecord[];
  /** Stones captured by Black, then by White */
  captures: [number, number];
  consecutivePasses: number;
  gameOver: boolean;
  /** Null on a draw and while the game is on */
  winnerId: GoPlayerId | null;
  result: GoResult | null;
  /** Set by scoring when two passes end the game, null otherwise */
  score: GoScore | null;
};

/**
 * A legal move plus the explanation the consensus viewer shows. `x` and `y`
 * are zero-based from the top-left corner; `label` reads as a player does,
 * "D4" or "pass".
 */
export type GoMove =
  | {
      kind: "place";
      x: number;
      y: number;
      label: string;
      reasoning?: string | undefined;
    }
  | { kind: "pass"; label: "pass"; reasoning?: string | undefined };

export type GoOptions = { size: GoSize };

export type GoShape = {
  state: GoState;
  event: GoEvent;
  command: GoCommand;
  move: GoMove;
  options: GoOptions;
  playerId: GoPlayerId;
};
