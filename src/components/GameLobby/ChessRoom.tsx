/**
 * Chess Room - the chess board hosted in a generic PartyKit room
 *
 * Everything the board needs comes from the room: the position from the chess
 * adapter, the seats from the player list, the names from the player info.
 */
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
import { useChessRoom } from "../../chess/use-chess-room";
import { isProcessing$, llmLogs$, players$ } from "../../context/game-signals";
import { BoardLayout, GameAreaLayout } from "../Board/BoardLayout";
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
    playerId: room.playerId,
    sendCommand: room.sendCommand,
  });
  const { leave, disconnectedOpponent } = useRoomChrome({
    room,
    isSpectator,
    onBack,
    ...(onResign !== undefined && { onResign }),
  });

  // The log signal outlives a local game, and a room's LLM seats run on the
  // server, so anything still in it belongs to a game this room never saw
  useState(() => {
    llmLogs$.value = [];
    return null;
  });

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
    return (
      <>
        <BoardLayout isPreviewMode={false} previewError={null}>
          <GameAreaLayout isPreviewMode={false}>
            <ChessBoard
              state={chess.state}
              seats={seats}
              localPlayerId={chess.localPlayerId}
              playerNames={playerNames}
              onMove={chess.move}
              disabled={!room.isConnected}
              {...(room.playerId !== null && {
                onSeatChange: changeSeat,
                onResign: chess.resign,
              })}
            />
          </GameAreaLayout>

          <GameSidebar
            log={<ChessLogRows moves={chess.state.moves} />}
            logEntries={chess.state.moves}
            turnStatus={
              <TurnStatusIndicator
                status={chessTurnStatus(
                  chess.state,
                  seats,
                  chess.localPlayerId,
                )}
                color={chessMoverColor(chess.state)}
              />
            }
            isProcessing={isProcessing$.value}
            appMode="multiplayer"
            seats={seats}
            {...(room.playerId !== null && { onSeatChange: changeSeat })}
            presets={chessPresets(seats)}
            onEndGame={leave}
          />
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
