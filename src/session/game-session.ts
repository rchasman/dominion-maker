/**
 * Every session a screen can open. The shell narrows on `game` to reach a
 * game's own verbs and on `mode` to reach a room's.
 */

import type { DominionSession } from "../context/dominion-session";
import type { ChessSession } from "../chess/chess-session";

export type GameSession = DominionSession | ChessSession;
