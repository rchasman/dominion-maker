import { lazy, Suspense } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  loadSeatPreset,
  saveSeatPreset,
  type SeatPreset,
} from "../core/seat-presets";
import { BoardLayout, GameAreaLayout } from "../components/Board/BoardLayout";
import { usePreviewMode } from "../components/preview/usePreviewMode";
import { usePreviewState } from "../components/preview/usePreviewState";
import { GameSidebar } from "../components/Board/GameSidebar";
import { TurnStatusIndicator } from "../components/Board/TurnStatusIndicator";
import { SessionProvider, useSession } from "../session/SessionContext";
import { ChessBoard } from "./ChessBoard";
import {
  ChessLogRows,
  chessMoverColor,
  chessPresets,
  chessTurnStatus,
} from "./sidebar";
import { createLocalChessSession } from "./create-local-chess-session";
import {
  clearStoredChessGame,
  loadChessSeats,
  restoreChessEngine,
  saveChessEvents,
  saveChessSeats,
} from "./storage";
import { chessDevtoolsAdapter, chessStateAt } from "./devtools";
import { createChessGame } from "./engine";
import { CHESS_SEAT_PRESETS, chessSeats } from "./presets";
import { CHESS_PLAYERS } from "./seat";

const EventDevtools = lazy(() =>
  import("../components/EventDevtools").then(m => ({
    default: m.EventDevtools,
  })),
);

/** The saved game when there is one, else a fresh one on the chosen preset */
function openChessTable() {
  const restored = restoreChessEngine();
  return {
    engine: restored ?? createChessGame([...CHESS_PLAYERS]),
    seats: chessSeats(restored !== null, loadChessSeats(), loadSeatPreset()),
  };
}

export function ChessApp({ onBackToHome }: { onBackToHome: () => void }) {
  const session = useMemo(() => createLocalChessSession(openChessTable()), []);

  // Leaving for the menu drops the game, so the next start honours the preset
  useEffect(() => () => clearStoredChessGame(), []);

  return (
    <SessionProvider session={session}>
      <ChessTable onBackToHome={onBackToHome} />
    </SessionProvider>
  );
}

function ChessTable({ onBackToHome }: { onBackToHome: () => void }) {
  const session = useSession();
  if (session.game !== "chess" || session.mode !== "local")
    throw new Error("ChessTable needs a local chess session");

  const state = session.state.value;
  const events = session.events.value;
  const seats = session.seats.value;
  const localHuman = session.localHumanSeat.value;
  const isProcessing = session.isProcessing.value;

  useEffect(() => {
    if (events.length > 0) saveChessEvents(events);
  }, [events]);

  useEffect(() => {
    if (Object.keys(seats).length > 0) saveChessSeats(seats);
  }, [seats]);

  const { previewEventId, enterPreview, exitPreview, isPreviewMode } =
    usePreviewMode();
  const [showDevtools, setShowDevtools] = useState(false);

  const stateAt = useMemo(() => chessStateAt(events), [events]);
  const { getStateAtEvent } = session;
  const preview = usePreviewState(previewEventId, getStateAtEvent);
  const devtoolsAdapter = useMemo(
    () => chessDevtoolsAdapter(events, stateAt),
    [events, stateAt],
  );

  if (state === null) return null;

  const newGame = () => {
    exitPreview();
    clearStoredChessGame();
    session.newGame();
  };

  const takeBack = () => {
    exitPreview();
    session.takeBack();
  };

  const branchFrom = (eventId: string) => {
    exitPreview();
    session.branchFrom(eventId);
  };

  const changePreset = (preset: SeatPreset) => {
    session.setSeats(CHESS_SEAT_PRESETS[preset].seats(CHESS_PLAYERS));
    saveSeatPreset(preset);
  };

  const displayState = preview.state ?? state;

  return (
    <BoardLayout isPreviewMode={isPreviewMode} previewError={preview.error}>
      <GameAreaLayout align="center" isPreviewMode={isPreviewMode}>
        <ChessBoard
          state={displayState}
          seats={seats}
          localPlayerId={localHuman}
          disabled={isPreviewMode}
          onMove={session.move}
          {...(!isPreviewMode && { onSeatChange: session.setSeat })}
          {...(localHuman !== null &&
            !isPreviewMode && {
              onTakeBack: takeBack,
              onResign: session.resign,
            })}
        />
      </GameAreaLayout>

      <GameSidebar
        log={<ChessLogRows moves={displayState.moves} />}
        logEntryCount={displayState.moves.length}
        turnStatus={
          <TurnStatusIndicator
            status={chessTurnStatus(
              displayState,
              seats,
              localHuman,
              isProcessing,
            )}
            color={chessMoverColor(displayState)}
          />
        }
        appMode="local"
        seats={seats}
        {...(!isPreviewMode && { onSeatChange: session.setSeat })}
        presets={chessPresets(seats, changePreset)}
        onNewGame={newGame}
        onBackToHome={onBackToHome}
      />

      <Suspense fallback={null}>
        <EventDevtools
          events={events}
          adapter={devtoolsAdapter}
          isOpen={showDevtools}
          onToggle={() => setShowDevtools(!showDevtools)}
          onBranchFrom={branchFrom}
          onScrub={enterPreview}
        />
      </Suspense>
    </BoardLayout>
  );
}
