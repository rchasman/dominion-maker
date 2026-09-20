/** Chess player ids are opaque strings, as everywhere else in the core */
export type ChessPlayerId = string;

/** White first, always: the FEN's side-to-move field indexes this pair */
export type ChessPlayerOrder = [ChessPlayerId, ChessPlayerId];

export type ChessGameInitialized = {
  type: "GAME_INITIALIZED";
  players: ChessPlayerOrder;
  id?: string | undefined;
};

export type ChessMoved = {
  type: "MOVE";
  playerId: ChessPlayerId;
  san: string;
  id?: string | undefined;
};

export type ChessResigned = {
  type: "RESIGNED";
  playerId: ChessPlayerId;
  id?: string | undefined;
};

export type ChessEvent = ChessGameInitialized | ChessMoved | ChessResigned;

export type ChessCommand =
  | { type: "MOVE"; playerId: ChessPlayerId; san: string }
  | { type: "RESIGN"; playerId: ChessPlayerId };

export type ChessResult = "checkmate" | "stalemate" | "draw" | "resignation";

export type ChessState = {
  fen: string;
  playerOrder: ChessPlayerOrder;
  /** SAN history, in order */
  moves: string[];
  gameOver: boolean;
  /** Null on a draw and while the game is on */
  winnerId: ChessPlayerId | null;
  result: ChessResult | null;
  inCheck: boolean;
};

/**
 * A legal move as chess.js reports it, plus the explanation the consensus
 * viewer shows. `from` and `to` are algebraic squares; the board reads them
 * for click-to-move and for highlighting the move just played.
 */
export type ChessMove = {
  san: string;
  from: string;
  to: string;
  promotion?: string | undefined;
  captured?: string | undefined;
  reasoning?: string | undefined;
};

/** Chess is set up by its rules alone */
export type ChessOptions = Record<string, never>;

export type ChessShape = {
  state: ChessState;
  event: ChessEvent;
  command: ChessCommand;
  move: ChessMove;
  options: ChessOptions;
  playerId: ChessPlayerId;
};
