/**
 * Chess Room - the chess board hosted in a generic PartyKit room
 *
 * Everything the board needs comes from the room session: the position from
 * the chess module's reading of the room, the seats from the player list, the
 * names from the player info.
 */
import { lazy, Suspense } from "preact/compat";
import { useMemo, useState } from "preact/hooks";
import { moduleFor } from "../../games";
import { ChessBoard } from "../../chess/ChessBoard";
import {
  ChessLogRows,
  chessMoverColor,
  chessPresets,
  chessTurnStatus,
} from "../../chess/sidebar";
import { chessDevtoolsAdapter } from "../../chess/devtools";
import { createRemoteChessSession } from "../../chess/create-remote-chess-session";
import { SessionProvider, useSession } from "../../session/SessionContext";
import { BoardLayout, GameAreaLayout } from "../Board/BoardLayout";
import { usePreviewMode } from "../preview/usePreviewMode";
import { usePreviewState } from "../preview/usePreviewState";
import { GameSidebar } from "../Board/GameSidebar";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { TurnStatusIndicator } from "../Board/TurnStatusIndicator";
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

export function ChessRoom(props: RoomProps) {
  const { roomId, playerName, clientId, isSpectator } = props;
  const session = useMemo(
    () =>
      createRemoteChessSession({ roomId, playerName, clientId, isSpectator }),
    [roomId, playerName, clientId, isSpectator],
  );

  return (
    <SessionProvider session={session}>
      <ChessRoomContent {...props} />
    </SessionProvider>
  );
}

function ChessRoomContent({ game, isSpectator, onBack, onResign }: RoomProps) {
  const room = useSession();
  if (room.game !== "chess" || room.mode !== "multiplayer")
    throw new Error("ChessRoomContent needs a chess room session");

  const { previewEventId, enterPreview, isPreviewMode } = usePreviewMode();
  const [showDevtools, setShowDevtools] = useState(false);
  const chessEvents = room.events.value;
  const { getStateAtEvent } = room;
  const preview = usePreviewState(previewEventId, getStateAtEvent);
  const devtoolsAdapter = useMemo(
    () =>
      chessDevtoolsAdapter(chessEvents, index => {
        const eventId = chessEvents[index]?.id;
        if (eventId === undefined) return null;
        return getStateAtEvent(eventId);
      }),
    [chessEvents, getStateAtEvent],
  );
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
    return (
      <>
        <BoardLayout isPreviewMode={isPreviewMode} previewError={preview.error}>
          <GameAreaLayout align="center" isPreviewMode={isPreviewMode}>
            <ChessBoard
              state={shown}
              seats={seats}
              localPlayerId={localHuman}
              playerNames={playerNames}
              onMove={room.move}
              disabled={!room.isConnected.value || isPreviewMode}
              {...(playerId !== null &&
                !isPreviewMode && {
                  onSeatChange: room.setSeat,
                  onResign: room.resign,
                })}
            />
          </GameAreaLayout>

          <GameSidebar
            log={<ChessLogRows moves={shown.moves} />}
            logEntryCount={shown.moves.length}
            turnStatus={
              <TurnStatusIndicator
                status={chessTurnStatus(
                  shown,
                  seats,
                  localHuman,
                  // A room's bots run on the server; no client turn is pending
                  false,
                )}
                color={chessMoverColor(shown)}
              />
            }
            appMode="multiplayer"
            seats={seats}
            {...(playerId !== null &&
              !isPreviewMode && { onSeatChange: room.setSeat })}
            presets={chessPresets(seats)}
            isSpectator={isSpectator}
            onBackToHome={leave}
          />

          <Suspense fallback={null}>
            <EventDevtools
              events={chessEvents}
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
              localStorage.removeItem("dominion_active_game");
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
      defaultLlm={moduleFor(game).defaultLlmSeat}
      onStart={controller =>
        room.startGame(undefined, [{ name: "AI Opponent", controller }])
      }
      notes={[room.unreadable.value ? UNREADABLE : null, room.error.value]}
      onLeave={leave}
    />
  );
}
