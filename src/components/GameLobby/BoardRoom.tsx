/**
 * Board Room - a board game hosted in a generic PartyKit room
 *
 * Everything the board needs comes from the room session: the position from
 * the game module's reading of the room, the seats from the player list, the
 * names from the player info.
 */
import { lazy, Suspense } from "preact/compat";
import { useMemo, useState } from "preact/hooks";
import type { GameSession } from "../../session/game-session";
import { SessionProvider } from "../../session/SessionContext";
import type { RoomTable } from "../../session/table-session";
import type { BoardGameSpec, BoardShape } from "../Board/board-game-spec";
import { BoardLayout, GameAreaLayout } from "../Board/BoardLayout";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { turnLogAdapter } from "../EventDevtools/turn-log-adapter";
import { GameSidebar } from "../Board/GameSidebar";
import { NO_SEAT_CONTROL, seatControlFor } from "../Board/seat-control";
import {
  moverColorFor,
  presetsFor,
  turnStatusFor,
} from "../Board/turn-sidebar";
import { TurnStatusIndicator } from "../Board/TurnStatusIndicator";
import { usePreviewMode } from "../preview/usePreviewMode";
import { usePreviewState } from "../preview/usePreviewState";
import { ACTIVE_GAME_STORAGE_KEY } from "./active-game-key";
import { DisconnectModal } from "./DisconnectModal";
import {
  GameOverNotification,
  SpectatorBadge,
  WaitingRoom,
  useRoomChrome,
  type RoomProps,
} from "./room-chrome";

const UNREADABLE = "This room sent a position this client cannot read.";

const EventDevtools = lazy(() =>
  import("../EventDevtools").then(m => ({ default: m.EventDevtools })),
);

type BoardRoomProps<G extends BoardShape, S extends GameSession> = RoomProps & {
  session: S & RoomTable<G>;
  spec: BoardGameSpec<G, S>;
};

export function BoardRoom<G extends BoardShape, S extends GameSession>(
  props: BoardRoomProps<G, S>,
) {
  return (
    <SessionProvider session={props.session}>
      <BoardRoomContent {...props} />
    </SessionProvider>
  );
}

function BoardRoomContent<G extends BoardShape, S extends GameSession>({
  session: room,
  spec,
  isSpectator,
  onBack,
  onResign,
}: BoardRoomProps<G, S>) {
  const { previewEventId, enterPreview, isPreviewMode } = usePreviewMode();
  const [showDevtools, setShowDevtools] = useState(false);
  const events = room.events.value;
  const { getStateAtEvent } = room;
  const preview = usePreviewState(previewEventId, getStateAtEvent);
  const devtoolsAdapter = useMemo(
    () =>
      turnLogAdapter(spec.logReading, events, index => {
        const eventId = events[index]?.id;
        if (eventId === undefined) return null;
        return getStateAtEvent(eventId);
      }),
    [spec.logReading, events, getStateAtEvent],
  );
  const { definition } = spec.module;
  const turnStatus = useMemo(() => turnStatusFor(definition), [definition]);
  const moverColor = useMemo(
    () => moverColorFor(definition, spec.colours),
    [definition, spec.colours],
  );
  const presets = useMemo(() => presetsFor(spec.presets), [spec.presets]);
  const playerId = room.localPlayerId.value;
  const { leave, disconnectedOpponent } = useRoomChrome({
    playerId,
    resign: room.resign,
    disconnectedPlayers: room.disconnectedPlayers.value,
    isSpectator,
    onBack,
    ...(onResign !== undefined && { onResign }),
  });

  const seats = room.seats.value;
  const playerInfo = room.playerInfo.value;
  const playerNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(playerInfo ?? {}).map(([id, info]) => [id, info.name]),
      ),
    [playerInfo],
  );

  const state = room.state.value;
  const gameEndReason = room.gameEndReason.value;
  if (state !== null) {
    if (!isSpectator && !playerId) return <BoardSkeleton />;
    const shown = preview.state ?? state;
    const localHuman = room.localHumanSeat.value;
    const seatControl =
      playerId === null || isSpectator || isPreviewMode
        ? NO_SEAT_CONTROL
        : seatControlFor({
            table: {
              mode: "room",
              seats,
              localPlayerId: playerId,
            },
            defaultLlm: spec.module.defaultLlmSeat,
            setSeat: room.setSeat,
            disabled: !room.isConnected.value,
          });
    return (
      <>
        <BoardLayout isPreviewMode={isPreviewMode} previewError={preview.error}>
          <GameAreaLayout align="center" isPreviewMode={isPreviewMode}>
            {spec.board({
              session: room,
              state: shown,
              localPlayerId: localHuman,
              playerNames,
              disabled: !room.isConnected.value || isPreviewMode,
              seatControl,
              ...(playerId !== null &&
                !isPreviewMode && { onResign: room.resign }),
            })}
          </GameAreaLayout>

          <GameSidebar
            log={spec.log({ state: shown, playerNames })}
            logEntryCount={spec.logEntryCount(shown)}
            turnStatus={
              <TurnStatusIndicator
                status={turnStatus(
                  shown,
                  seats,
                  localHuman,
                  // A room's bots run on the server; no client turn is pending
                  false,
                )}
                color={moverColor(shown)}
              />
            }
            appMode="multiplayer"
            seats={seats}
            {...(playerId !== null &&
              !isPreviewMode && { onSeatChange: room.setSeat })}
            presets={presets(seats)}
            isSpectator={isSpectator}
            onBackToHome={leave}
          />

          <Suspense fallback={null}>
            <EventDevtools
              events={events}
              adapter={devtoolsAdapter}
              isOpen={showDevtools}
              onToggle={() => setShowDevtools(!showDevtools)}
              onScrub={enterPreview}
            />
          </Suspense>
        </BoardLayout>
        {isSpectator && <SpectatorBadge />}
        {disconnectedOpponent && (
          <DisconnectModal
            playerName={disconnectedOpponent.playerName}
            onLeave={leave}
          />
        )}
        {gameEndReason && (
          <GameOverNotification
            message={gameEndReason}
            onClose={() => {
              localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
              onBack();
            }}
          />
        )}
      </>
    );
  }

  return (
    <WaitingRoom
      isSpectator={isSpectator}
      alone={room.isHost.value && room.players.value.length < 2}
      defaultLlm={spec.module.defaultLlmSeat}
      onStart={controller =>
        room.startGame(undefined, [{ name: "AI Opponent", controller }])
      }
      notes={[room.unreadable.value ? UNREADABLE : null, room.error.value]}
      onLeave={leave}
    />
  );
}
