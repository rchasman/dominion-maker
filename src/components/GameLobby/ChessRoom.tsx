/**
 * Chess Room - the chess board hosted in a generic PartyKit room
 *
 * Everything the board needs comes from the room: the position from the chess
 * adapter, the seats from the player list, the names from the player info.
 */
import { lazy, Suspense } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";
import { usePartyGame } from "../../partykit/usePartyGame";
import type { ControllerConfig } from "../../core/seats";
import { HUMAN_SEAT, sameConfig, seatFromKind } from "../../core/seats";
import { moduleFor } from "../../games";
import { ChessBoard } from "../../chess/ChessBoard";
import {
  ChessLogRows,
  chessMoverColor,
  chessPresets,
  chessTurnStatus,
} from "../../chess/sidebar";
import { chessDevtoolsAdapter } from "../../chess/devtools";
import { useChessRoom } from "../../chess/use-chess-room";
import { llmLogs$, players$ } from "../../context/game-signals";
import { BoardLayout, GameAreaLayout } from "../Board/BoardLayout";
import { usePreviewMode } from "../Board/usePreviewMode";
import { usePreviewState } from "../Board/usePreviewState";
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

const EventDevtools = lazy(() =>
  import("../EventDevtools").then(m => ({ default: m.EventDevtools })),
);

export function ChessRoom({
  roomId,
  game,
  playerName,
  clientId,
  isSpectator,
  onBack,
  onResign,
}: RoomProps) {
  const room = usePartyGame({
    roomId,
    game,
    playerName,
    clientId,
    isSpectator,
  });
  const chess = useChessRoom({
    state: room.state,
    events: room.events,
    playerId: room.playerId,
    sendCommand: room.sendCommand,
    getStateAtEvent: room.getStateAtEvent,
  });
  const { previewEventId, enterPreview, exitPreview, isPreviewMode } =
    usePreviewMode();
  const [showDevtools, setShowDevtools] = useState(false);
  const preview = usePreviewState(previewEventId, chess.stateAtEvent);
  const devtoolsAdapter = useMemo(
    () =>
      chessDevtoolsAdapter(chess.events, index => {
        const eventId = chess.events[index]?.id;
        if (eventId === undefined) return null;
        return chess.stateAtEvent(eventId);
      }),
    [chess.events, chess.stateAtEvent],
  );
  const { leave, disconnectedOpponent } = useRoomChrome({
    room,
    isSpectator,
    onBack,
    ...(onResign !== undefined && { onResign }),
  });

  // A room's LLM seats vote on the server, so the votes arrive over the wire
  useEffect(() => {
    llmLogs$.value = room.consensusLog;
  }, [room.consensusLog]);

  // Other seats arrive as kinds only; this client's own LLM config stays here
  const [ownSeat, setOwnSeat] = useState<ControllerConfig>(HUMAN_SEAT);
  const seats = useMemo(
    () =>
      Object.fromEntries(
        room.players.map(p => [
          p.playerId,
          p.playerId === room.playerId && ownSeat.kind === p.controller
            ? ownSeat
            : seatFromKind(p.controller, moduleFor(game).defaultLlmSeat),
        ]),
      ),
    [room.players, room.playerId, ownSeat, game],
  );

  // The seat selectors name a player, and a room's player ids are client ids
  useEffect(() => {
    players$.value = room.players.map(p => ({ id: p.playerId, name: p.name }));
  }, [room.players]);

  const playerNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(room.playerInfo ?? {}).map(([id, info]) => [
          id,
          info.name,
        ]),
      ),
    [room.playerInfo],
  );

  const changeSeat = (player: string, controller: ControllerConfig) => {
    if (player === room.playerId && !sameConfig(controller, ownSeat)) {
      setOwnSeat(controller);
    }
    room.setSeat(player, controller);
  };

  if (chess.state !== null) {
    if (!isSpectator && !room.playerId) return <BoardSkeleton />;
    const shown = preview.state ?? chess.state;
    return (
      <>
        <BoardLayout isPreviewMode={isPreviewMode} previewError={preview.error}>
          <GameAreaLayout align="center" isPreviewMode={isPreviewMode}>
            <ChessBoard
              state={shown}
              seats={seats}
              localPlayerId={chess.localPlayerId}
              playerNames={playerNames}
              onMove={san => {
                exitPreview();
                chess.move(san);
              }}
              disabled={!room.isConnected || isPreviewMode}
              {...(room.playerId !== null &&
                !isPreviewMode && {
                  onSeatChange: changeSeat,
                  onResign: chess.resign,
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
                  chess.localPlayerId,
                  // A room's bots run on the server; no client turn is pending
                  false,
                )}
                color={chessMoverColor(shown)}
              />
            }
            appMode="multiplayer"
            seats={seats}
            {...(room.playerId !== null &&
              !isPreviewMode && { onSeatChange: changeSeat })}
            presets={chessPresets(seats)}
            isSpectator={isSpectator}
            onBackToHome={leave}
          />

          <Suspense fallback={null}>
            <EventDevtools
              events={chess.events}
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
        {room.gameEndReason && (
          <GameOverNotification
            message={room.gameEndReason}
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
      alone={room.isHost && room.players.length < 2}
      defaultLlm={moduleFor(game).defaultLlmSeat}
      onStart={controller =>
        room.startGame(undefined, [{ name: "AI Opponent", controller }])
      }
      notes={[chess.error, room.error]}
      onLeave={leave}
    />
  );
}
