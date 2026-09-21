/**
 * Game Room - Pre-game lobby and in-game wrapper
 *
 * One room session per room. The room's game picks the board and the session
 * that turns the room's opaque state into a game state, so each game owns its
 * own session and only the chrome is shared.
 */
import { useMemo } from "preact/hooks";
import { moduleFor } from "../../games";
import { Board } from "../Board";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { DisconnectModal } from "./DisconnectModal";
import { createRemoteDominionSession } from "../../context/create-remote-dominion-session";
import { AnimationProvider } from "../../animation";
import {
  SessionProvider,
  useDominionSession,
} from "../../session/SessionContext";
import { ChessRoom } from "./ChessRoom";
import { ACTIVE_GAME_STORAGE_KEY } from "./active-game-key";
import {
  GameOverNotification,
  SpectatorBadge,
  UNREADABLE_GAME,
  WaitingRoom,
  useRoomChrome,
  type RoomProps,
} from "./room-chrome";

/** Exhaustive on purpose: a third game must not fall through to Dominion */
export function GameRoom(props: RoomProps) {
  switch (props.game) {
    case "chess":
      return <ChessRoom {...props} />;
    case "dominion":
      return <DominionRoom {...props} />;
  }
}

function DominionRoom(props: RoomProps) {
  const { roomId, playerName, clientId, isSpectator } = props;
  const session = useMemo(
    () =>
      createRemoteDominionSession({
        roomId,
        playerName,
        clientId,
        isSpectator,
      }),
    [roomId, playerName, clientId, isSpectator],
  );

  return (
    <SessionProvider session={session}>
      <DominionRoomContent {...props} />
    </SessionProvider>
  );
}

function DominionRoomContent({
  game,
  isSpectator,
  onBack,
  onResign,
}: RoomProps) {
  const room = useDominionSession();
  if (room.mode !== "multiplayer")
    throw new Error("DominionRoomContent needs a room session");

  const playerId = room.localPlayerId.value;
  const { leave, disconnectedOpponent } = useRoomChrome({
    playerId,
    resign: room.resign,
    disconnectedPlayers: room.disconnectedPlayers.value,
    isSpectator,
    onBack,
    ...(onResign !== undefined && { onResign }),
  });

  const gameEndReason = room.gameEndReason.value;
  if (room.state.value) {
    // Wait for playerId to be set before rendering Board
    if (!isSpectator && !playerId) {
      return <BoardSkeleton />;
    }

    return (
      <AnimationProvider>
        <Board onBackToHome={leave} />
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
      </AnimationProvider>
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
      notes={[room.unreadable.value ? UNREADABLE_GAME : null, room.error.value]}
      onLeave={leave}
    />
  );
}
