/**
 * Multiplayer Lobby Screen
 *
 * Orchestrates the multiplayer flow:
 * 1. Reconnect screen (saved session)
 * 2. Create/Join screen (not connected)
 * 3. Lobby room (connected, waiting)
 * 4. Game (playing)
 */
import { useMultiplayer } from "../../context/MultiplayerContext";
import { CreateJoinScreen } from "./CreateJoinScreen";
import { LobbyRoom } from "./LobbyRoom";
import { MultiplayerGameBoard } from "./MultiplayerGameBoard";
import { ReconnectScreen } from "./ReconnectScreen";

interface MultiplayerScreenProps {
  onBack: () => void;
  onGameStart?: () => void;
}

export function MultiplayerScreen({ onBack, onGameStart }: MultiplayerScreenProps) {
  const { isConnected, isInLobby, isPlaying, gameState, hasSavedSession } = useMultiplayer();

  // Saved session but not connected yet - show reconnect screen
  if (hasSavedSession && !isConnected) {
    return <ReconnectScreen onBack={onBack} />;
  }

  // Not connected and no saved session - show create/join
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
