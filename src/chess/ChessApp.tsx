import { useEffect, useRef, useState } from "preact/hooks";
import type { LLMLogEntry } from "../components/LLMLog";
import type { LLMLogEntryInput, LLMLogger } from "../core/consensus/types";
import type { Seats } from "../core/seats";
import { firstHumanSeat } from "../core/seats";
import {
  appMode$,
  isProcessing$,
  llmLogs$,
  players$,
  seats$,
  updateSeat,
} from "../context/game-signals";
import { loadSeats, STORAGE_KEYS } from "../context/storage-utils";
import { loadSeatPreset } from "../context/seat-presets";
import { uiLogger } from "../lib/logger";
import { ChessBoard } from "./ChessBoard";
import {
  chessEvents$,
  chessState$,
  clearStoredChessGame,
  CHESS_PLAYERS,
  restoreChessEngine,
  saveChessEvents,
  syncChessEngine,
} from "./context";
import { createChessGame, type ChessEngine } from "./engine";
import { CHESS_SEAT_PRESETS } from "./presets";
import { useChessSeatDriver } from "./use-chess-seat-driver";

const CHESS_SEAT_NAMES = [
  { id: "w", name: "White" },
  { id: "b", name: "Black" },
];

const createLogEntry = (
  entry: LLMLogEntryInput,
  eventCount: number | undefined,
): LLMLogEntry => ({
  ...entry,
  id: `${Date.now()}-${Math.random()}`,
  timestamp: Date.now(),
  data: { ...entry.data, eventCount },
});

/**
 * Seats saved by the other game name players this one does not have. Falling
 * back to the preset keeps a board that nobody can move from ever appearing.
 */
const seatsForChess = (): Seats => {
  const saved = loadSeats();
  if (saved !== null && CHESS_PLAYERS.every(id => id in saved)) return saved;
  return CHESS_SEAT_PRESETS[loadSeatPreset()].seats(CHESS_PLAYERS);
};

export function ChessApp({ onBackToHome }: { onBackToHome: () => void }) {
  const engineRef = useRef<ChessEngine | null>(null);

  useState(() => {
    const engine = restoreChessEngine() ?? createChessGame([...CHESS_PLAYERS]);
    engineRef.current = engine;
    seats$.value = seatsForChess();
    llmLogs$.value = [];
    isProcessing$.value = false;
    appMode$.value = "local";
    players$.value = CHESS_SEAT_NAMES;
    syncChessEngine(engine);
    return null;
  });

  const loggerRef = useRef<LLMLogger>(entry => {
    llmLogs$.value = [
      ...llmLogs$.value,
      createLogEntry(entry, engineRef.current?.eventLog.length),
    ];
  });

  const state = chessState$.value;
  const events = chessEvents$.value;
  const seats = seats$.value;
  const localHuman = firstHumanSeat<string>(seats, [...CHESS_PLAYERS]);

  useEffect(() => {
    if (events.length > 0) saveChessEvents(events);
  }, [events]);

  useEffect(() => {
    if (Object.keys(seats).length > 0) {
      localStorage.setItem(STORAGE_KEYS.SEATS, JSON.stringify(seats));
    }
  }, [seats]);

  // Leaving for the menu drops the game, so the next start honours the preset
  useEffect(
    () => () => {
      clearStoredChessGame();
      players$.value = [];
    },
    [],
  );

  useChessSeatDriver(engineRef, loggerRef.current, localHuman);

  if (state === null) return null;

  const dispatch = (command: Parameters<ChessEngine["dispatch"]>[0]) => {
    const engine = engineRef.current;
    if (engine === null) return;
    const result = engine.dispatch(command);
    if (!result.ok) {
      uiLogger.error("Chess command refused", { error: result.error });
      return;
    }
    syncChessEngine(engine);
  };

  const newGame = () => {
    clearStoredChessGame();
    llmLogs$.value = [];
    isProcessing$.value = false;
    const engine = createChessGame([...CHESS_PLAYERS]);
    engineRef.current = engine;
    syncChessEngine(engine);
  };

  /**
   * Rewind to just before the human's own last move, so the human is to move
   * again. Stopping anywhere else hands the position straight back to the bot,
   * which replays the same move and makes the button look broken.
   */
  const takeBack = () => {
    const engine = engineRef.current;
    if (engine === null || localHuman === null) return;
    const log = engine.eventLog;
    const index = log.reduce<number>(
      (last, event, at) =>
        "playerId" in event && event.playerId === localHuman ? at : last,
      -1,
    );
    if (index < 0) return;
    isProcessing$.value = false;
    engine.truncateTo(index);
    syncChessEngine(engine);
  };

  return (
    <ChessBoard
      state={state}
      seats={seats}
      entries={llmLogs$.value}
      localPlayerId={localHuman}
      onMove={san => {
        if (localHuman === null) return;
        dispatch({ type: "MOVE", playerId: localHuman, san });
      }}
      onSeatChange={updateSeat}
      onNewGame={newGame}
      {...(localHuman !== null && {
        onTakeBack: takeBack,
        onResign: () => dispatch({ type: "RESIGN", playerId: localHuman }),
      })}
      onBack={onBackToHome}
    />
  );
}
