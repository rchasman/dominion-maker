/**
 * Game Room - Pre-game lobby and in-game wrapper
 *
 * One PartySocket connection per room. The room's game picks the board and
 * the adapter that turns the room's opaque state into a game state, so each
 * game owns its own hooks and only the chrome is shared.
 */
import { usePartyGame } from "../../partykit/usePartyGame";
import { moduleFor } from "../../games";
import { Board } from "../Board";
import { BoardSkeleton } from "../Board/BoardSkeleton";
import { DisconnectModal } from "./DisconnectModal";
import { useMultiplayerGameContext } from "../../context/use-multiplayer-game-context";
import { gameState$ } from "../../context/game-signals";
import { AnimationProvider } from "../../animation";
import { ChessRoom } from "./ChessRoom";
import {
  GameOverNotification,
  SpectatorBadge,
  UNREADABLE_GAME,
  WaitingRoom,
  useRoomChrome,
  type RoomProps,
} from "./room-chrome";

export function GameRoom(props: RoomProps) {
  if (props.game === "chess") return <ChessRoom {...props} />;
  return <DominionRoom {...props} />;
}

function DominionRoom({
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

  // Sync multiplayer state into signals
  useMultiplayerGameContext({ game: room, playerName, isSpectator });

  const { leave, disconnectedOpponent } = useRoomChrome({
    room,
    isSpectator,
    onBack,
    ...(onResign !== undefined && { onResign }),
  });

  // Both preconditions, and neither alone. The room's own state says this room
  // has a game; the parsed one says this client can read it. gameState$ is
  // module level and outlives a room, so on its own it shows the last game.
  const parsedState = gameState$.value;
  const unreadableState = room.state !== null && parsedState === null;

  if (room.state && parsedState) {
    // Wait for playerId to be set before rendering Board
    if (!isSpectator && !room.playerId) {
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
        {room.gameEndReason && (
          <GameOverNotification
            message={room.gameEndReason}
            onClose={() => {
              localStorage.removeItem("dominion_active_game");
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
      alone={room.isHost && room.players.length < 2}
      defaultLlm={moduleFor(game).defaultLlmSeat}
      onStart={controller =>
        room.startGame(undefined, [{ name: "AI Opponent", controller }])
      }
      notes={[unreadableState ? UNREADABLE_GAME : null, room.error]}
      onLeave={leave}
    />
  );
}
