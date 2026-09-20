import { useEffect, useRef, useState } from "preact/hooks";
import type { LLMLogEntry } from "../components/LLMLog";
import type { LLMLogEntryInput, LLMLogger } from "../core/consensus/types";
import { firstHumanSeat } from "../core/seats";
import {
  appMode$,
  isProcessing$,
  llmLogs$,
  players$,
  seats$,
  updateSeat,
} from "../context/game-signals";
import {
  loadSeatPreset,
  saveSeatPreset,
  type SeatPreset,
} from "../context/seat-presets";
import { uiLogger } from "../lib/logger";
import { BoardLayout, GameAreaLayout } from "../components/Board/BoardLayout";
import { GameSidebar } from "../components/Board/GameSidebar";
import { TurnStatusIndicator } from "../components/Board/TurnStatusIndicator";
import { ChessBoard } from "./ChessBoard";
import {
  ChessLogRows,
  chessMoverColor,
  chessPresets,
  chessTurnStatus,
} from "./sidebar";
import {
  chessEvents$,
  chessState$,
  clearStoredChessGame,
  loadChessSeats,
  restoreChessEngine,
  saveChessEvents,
  saveChessSeats,
  syncChessEngine,
} from "./context";
import { createChessGame, type ChessEngine } from "./engine";
import { CHESS_SEAT_PRESETS, chessSeats } from "./presets";
import { CHESS_PLAYERS } from "./seat";
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

export function ChessApp({ onBackToHome }: { onBackToHome: () => void }) {
  const engineRef = useRef<ChessEngine | null>(null);

  useState(() => {
    const restored = restoreChessEngine();
    const engine = restored ?? createChessGame([...CHESS_PLAYERS]);
    engineRef.current = engine;
    seats$.value = chessSeats(
      restored !== null,
      loadChessSeats(),
      loadSeatPreset(),
    );
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
    if (Object.keys(seats).length > 0) saveChessSeats(seats);
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

  const changePreset = (preset: SeatPreset) => {
    seats$.value = CHESS_SEAT_PRESETS[preset].seats(CHESS_PLAYERS);
    saveSeatPreset(preset);
  };

  return (
    <BoardLayout>
      <GameAreaLayout>
        <ChessBoard
          state={state}
          seats={seats}
          localPlayerId={localHuman}
          onMove={san => {
            if (localHuman === null) return;
            dispatch({ type: "MOVE", playerId: localHuman, san });
          }}
          onSeatChange={updateSeat}
          {...(localHuman !== null && {
            onTakeBack: takeBack,
            onResign: () => dispatch({ type: "RESIGN", playerId: localHuman }),
          })}
        />
      </GameAreaLayout>

      <GameSidebar
        log={<ChessLogRows moves={state.moves} />}
        logEntryCount={state.moves.length}
        turnStatus={
          <TurnStatusIndicator
            status={chessTurnStatus(
              state,
              seats,
              localHuman,
              isProcessing$.value,
            )}
            color={chessMoverColor(state)}
          />
        }
        appMode="local"
        seats={seats}
        onSeatChange={updateSeat}
        presets={chessPresets(seats, changePreset)}
        onNewGame={newGame}
        onBackToHome={onBackToHome}
      />
    </BoardLayout>
  );
}
