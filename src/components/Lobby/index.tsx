/**
 * Multiplayer Lobby Screen
 *
 * Orchestrates the multiplayer flow:
 * 1. Create/Join screen (not connected) - includes rejoin if saved session
 * 2. Lobby room (connected, waiting)
 * 3. Game (playing)
 */
import { useMultiplayer } from "../../context/multiplayer-hooks";
import { CreateJoinScreen } from "./CreateJoinScreen";
import { LobbyRoom } from "./LobbyRoom";
import { MultiplayerGameBoard } from "./MultiplayerGameBoard";

interface MultiplayerScreenProps {
  onBack: () => void;
  onGameStart?: () => void;
}

export function MultiplayerScreen({
  onBack,
  onGameStart,
}: MultiplayerScreenProps) {
  const { isConnected, isInLobby, isPlaying, gameState } = useMultiplayer();

  // Not connected - show create/join (includes rejoin if available)
  if (!isConnected) {
    return <CreateJoinScreen onBack={onBack} />;
  }

  // Connected and in lobby - show lobby room
  if (isInLobby) {
    return <LobbyRoom />;
  }

  // Game started - show game board
  if (isPlaying && gameState) {
    onGameStart?.();
    return <MultiplayerGameBoard onBackToHome={onBack} />;
  }

  // Fallback
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        color: "var(--color-text-secondary)",
      }}
    >
      Connecting...
    </div>
  );
}

export { CreateJoinScreen } from "./CreateJoinScreen";
export { LobbyRoom } from "./LobbyRoom";
export { ReconnectScreen } from "./ReconnectScreen";
