/**
 * A board game on a local table: the board in the game area, the shared
 * sidebar, preview mode and the scrubber, with the log and the seats saved
 * after every change. Leaving for the menu drops the game, so the next start
 * honours the preset.
 */
import { lazy, Suspense } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";
import { saveSeatPreset, type SeatPreset } from "../../core/seat-presets";
import type { GameSession } from "../../session/game-session";
import { SessionProvider } from "../../session/SessionContext";
import type { LocalTurnTable } from "../../session/table-session";
import { stateAtFor, turnLogAdapter } from "../EventDevtools/turn-log-adapter";
import { usePreviewMode } from "../preview/usePreviewMode";
import { usePreviewState } from "../preview/usePreviewState";
import type { BoardGameSpec, BoardShape } from "./board-game-spec";
import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { GameSidebar } from "./GameSidebar";
import { moverColorFor, presetsFor, turnStatusFor } from "./turn-sidebar";
import { TurnStatusIndicator } from "./TurnStatusIndicator";

const EventDevtools = lazy(() =>
  import("../EventDevtools").then(m => ({ default: m.EventDevtools })),
);

type LocalTableViewProps<G extends BoardShape, S extends GameSession> = {
  session: S & LocalTurnTable<G>;
  spec: BoardGameSpec<G, S>;
  onBackToHome: () => void;
};

export function LocalTableView<G extends BoardShape, S extends GameSession>(
  props: LocalTableViewProps<G, S>,
) {
  const { clearGame } = props.spec.storage;
  useEffect(() => () => clearGame(), [clearGame]);

  return (
    <SessionProvider session={props.session}>
      <LocalTableContent {...props} />
    </SessionProvider>
  );
}

function LocalTableContent<G extends BoardShape, S extends GameSession>({
  session,
  spec,
  onBackToHome,
}: LocalTableViewProps<G, S>) {
  const { storage } = spec;
  const state = session.state.value;
  const events = session.events.value;
  const seats = session.seats.value;
  const localHuman = session.localHumanSeat.value;
  const isProcessing = session.isProcessing.value;

  useEffect(() => {
    if (events.length > 0) storage.saveEvents(events);
  }, [storage, events]);

  useEffect(() => {
    if (Object.keys(seats).length > 0) storage.saveSeats(seats);
  }, [storage, seats]);

  const { previewEventId, enterPreview, exitPreview, isPreviewMode } =
    usePreviewMode();
  const [showDevtools, setShowDevtools] = useState(false);

  const stateAt = useMemo(
    () => stateAtFor(spec.module)(events),
    [spec.module, events],
  );
  const { getStateAtEvent } = session;
  const preview = usePreviewState(previewEventId, getStateAtEvent);
  const devtoolsAdapter = useMemo(
    () => turnLogAdapter(spec.logReading, events, stateAt),
    [spec.logReading, events, stateAt],
  );
  const { definition } = spec.module;
  const turnStatus = useMemo(() => turnStatusFor(definition), [definition]);
  const moverColor = useMemo(
    () => moverColorFor(definition, spec.colours),
    [definition, spec.colours],
  );
  const presets = useMemo(() => presetsFor(spec.presets), [spec.presets]);

  if (state === null) return null;

  const newGame = () => {
    exitPreview();
    storage.clearGame();
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
    session.setSeats(spec.presets[preset].seats(spec.players));
    saveSeatPreset(preset);
  };

  const displayState = preview.state ?? state;

  return (
    <BoardLayout isPreviewMode={isPreviewMode} previewError={preview.error}>
      <GameAreaLayout align="center" isPreviewMode={isPreviewMode}>
        {spec.board({
          session,
          state: displayState,
          seats,
          localPlayerId: localHuman,
          playerNames: {},
          disabled: isPreviewMode,
          ...(!isPreviewMode && { onSeatChange: session.setSeat }),
          ...(localHuman !== null &&
            !isPreviewMode && {
              onTakeBack: takeBack,
              onResign: session.resign,
            }),
        })}
      </GameAreaLayout>

      <GameSidebar
        log={spec.log(displayState)}
        logEntryCount={spec.logEntryCount(displayState)}
        turnStatus={
          <TurnStatusIndicator
            status={turnStatus(displayState, seats, localHuman, isProcessing)}
            color={moverColor(displayState)}
          />
        }
        appMode="local"
        seats={seats}
        {...(!isPreviewMode && { onSeatChange: session.setSeat })}
        presets={presets(seats, changePreset)}
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
