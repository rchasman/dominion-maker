import { uiLogger } from "../../lib/logger";
/**
 * Create/Join Room Screen
 *
 * Initial screen for multiplayer - create a new room or join existing.
 */
import { useState, useEffect } from "preact/hooks";
import { useMultiplayer } from "../../context/multiplayer-hooks";

interface CreateJoinScreenProps {
  onBack: () => void;
}

const MAX_RANDOM_PLAYER_NUMBER = 9999;
const MIN_ROOM_CODE_LENGTH = 6;
const BUTTON_OPACITY_DISABLED = 0.7;

function generateRandomPlayerName() {
  return `Player${Math.floor(Math.random() * MAX_RANDOM_PLAYER_NUMBER)}`;
}

const baseButtonStyle = {
  padding: "var(--space-6) var(--space-10)",
  fontSize: "0.875rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.125rem",
  fontFamily: "inherit",
  boxShadow: "var(--shadow-lg)",
  borderRadius: "4px",
};

const primaryButtonStyle = {
  ...baseButtonStyle,
  background:
    "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
  color: "#fff",
  border: "2px solid var(--color-victory)",
};

const reconnectButtonStyle = {
  ...baseButtonStyle,
  background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
  color: "#fff",
  border: "2px solid #3b82f6",
};

const secondaryButtonStyle = {
  ...baseButtonStyle,
  background: "var(--color-bg-secondary)",
  color: "var(--color-text-primary)",
  border: "1px solid var(--color-border-primary)",
};

interface ActionButtonsProps {
  hasSavedSession: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  onReconnect: () => void;
  onCreate: () => void;
  onJoin: () => void;
}

function ActionButtons({
  hasSavedSession,
  isConnecting,
  isReconnecting,
  onReconnect,
  onCreate,
  onJoin,
}: ActionButtonsProps) {
  const isDisabled = isConnecting || isReconnecting;
  const opacity = isDisabled ? BUTTON_OPACITY_DISABLED : 1;
  const cursor = isDisabled ? "wait" : "pointer";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        alignItems: "stretch",
        minWidth: "300px",
      }}
    >
      {hasSavedSession && (
        <button
          onClick={onReconnect}
          disabled={isDisabled}
          style={{ ...reconnectButtonStyle, cursor, opacity }}
        >
          {isReconnecting ? "Reconnecting..." : "Rejoin Room"}
        </button>
      )}
      <button
        onClick={onCreate}
        disabled={isDisabled}
        style={{ ...primaryButtonStyle, cursor, opacity }}
      >
        {isConnecting ? "Creating..." : "Create Room"}
      </button>
      <button
        onClick={onJoin}
        disabled={isDisabled}
        style={{
          ...secondaryButtonStyle,
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        Join Room
      </button>
    </div>
  );
}

interface RoomCodeInputProps {
  value: string;
  onChange: (code: string) => void;
}

function RoomCodeInput({ value, onChange }: RoomCodeInputProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        alignItems: "center",
      }}
    >
      <label
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.1rem",
        }}
      >
        Room Code
      </label>
      <input
        type="text"
        value={value}
        onChange={e => {
          const target = e.target as HTMLInputElement;
          onChange(target.value.toUpperCase());
        }}
        placeholder="ABCDEF"
        maxLength={MIN_ROOM_CODE_LENGTH}
        style={{
          padding: "var(--space-3) var(--space-4)",
          fontSize: "1.5rem",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "4px",
          color: "var(--color-text-primary)",
          width: "150px",
          textAlign: "center",
          fontFamily: "monospace",
          letterSpacing: "0.25rem",
        }}
      />
    </div>
  );
}

interface JoinInputProps {
  joinCode: string;
  isConnecting: boolean;
  onJoinCodeChange: (code: string) => void;
  onJoin: () => void;
  onBack: () => void;
}

function JoinInput({
  joinCode,
  isConnecting,
  onJoinCodeChange,
  onJoin,
  onBack,
}: JoinInputProps) {
  const isCodeValid = joinCode.length >= MIN_ROOM_CODE_LENGTH;
  const isDisabled = isConnecting || !isCodeValid;

  const buttonStyle = {
    ...baseButtonStyle,
    background: isCodeValid
      ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
      : "var(--color-bg-tertiary)",
    color: isCodeValid ? "#fff" : "var(--color-text-tertiary)",
    border: isCodeValid
      ? "2px solid var(--color-victory)"
      : "2px solid var(--color-border-primary)",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isConnecting ? BUTTON_OPACITY_DISABLED : 1,
  };

  return (
    <>
      <RoomCodeInput value={joinCode} onChange={onJoinCodeChange} />
      <button onClick={onJoin} disabled={isDisabled} style={buttonStyle}>
        {isConnecting ? "Joining..." : "Join Room"}
      </button>
      <button
        onClick={onBack}
        style={{
          padding: "var(--space-2) var(--space-4)",
          fontSize: "0.75rem",
          background: "transparent",
          color: "var(--color-text-tertiary)",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Back
      </button>
    </>
  );
}

interface ScreenHeaderProps {
  error: string | null;
}

function ScreenHeader({ error }: ScreenHeaderProps) {
  return (
    <>
      <h1
        style={{
          margin: 0,
          fontSize: "3rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}
      >
        MULTIPLAYER
      </h1>

      {error && (
        <div
          style={{
            padding: "var(--space-4)",
            background: "rgba(220, 38, 38, 0.2)",
            border: "1px solid rgba(220, 38, 38, 0.5)",
            borderRadius: "4px",
            color: "#fca5a5",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

interface ScreenContentProps {
  showJoinInput: boolean;
  hasSavedSession: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  joinCode: string;
  onReconnect: () => void;
  onCreate: () => void;
  onShowJoin: () => void;
  onJoinCodeChange: (code: string) => void;
  onJoin: () => void;
  onBackFromJoin: () => void;
}

function ScreenContent({
  showJoinInput,
  hasSavedSession,
  isConnecting,
  isReconnecting,
  joinCode,
  onReconnect,
  onCreate,
  onShowJoin,
  onJoinCodeChange,
  onJoin,
  onBackFromJoin,
}: ScreenContentProps) {
  if (showJoinInput) {
    return (
      <JoinInput
        joinCode={joinCode}
        isConnecting={isConnecting}
        onJoinCodeChange={onJoinCodeChange}
        onJoin={onJoin}
        onBack={onBackFromJoin}
      />
    );
  }

  return (
    <>
      {hasSavedSession && (
        <p
          style={{
            color: "var(--color-text-secondary)",
            margin: 0,
            fontSize: "0.875rem",
          }}
        >
          You have an active game session
        </p>
      )}

      <ActionButtons
        hasSavedSession={hasSavedSession}
        isConnecting={isConnecting}
        isReconnecting={isReconnecting}
        onReconnect={onReconnect}
        onCreate={onCreate}
        onJoin={onShowJoin}
      />
    </>
  );
}

export function CreateJoinScreen({ onBack }: CreateJoinScreenProps) {
  const {
    createRoom,
    joinRoom,
    isConnecting,
    isReconnecting,
    error,
    hasSavedSession,
    reconnectToSavedRoom,
  } = useMultiplayer();

  // Auto-reconnect on mount if saved session exists
  useEffect(() => {
    if (hasSavedSession && !isConnecting && !isReconnecting) {
      uiLogger.debug("[CreateJoinScreen] Auto-reconnecting to saved session");
      reconnectToSavedRoom().catch(e => {
        uiLogger.error("[CreateJoinScreen] Auto-reconnect failed:", e);
      });
    }
  }, [hasSavedSession, reconnectToSavedRoom, isConnecting, isReconnecting]);

  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCreate = async () => {
    try {
      await createRoom(generateRandomPlayerName());
    } catch {
      // Error is handled in context
    }
  };

  const handleJoin = async () => {
    if (joinCode.length < MIN_ROOM_CODE_LENGTH) return;
    try {
      await joinRoom(joinCode.trim(), generateRandomPlayerName());
    } catch {
      // Error is handled in context
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-8)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <ScreenHeader error={error} />

      <ScreenContent
        showJoinInput={showJoinInput}
        hasSavedSession={hasSavedSession}
        isConnecting={isConnecting}
        isReconnecting={isReconnecting}
        joinCode={joinCode}
        onReconnect={reconnectToSavedRoom}
        onCreate={handleCreate}
        onShowJoin={() => setShowJoinInput(true)}
        onJoinCodeChange={setJoinCode}
        onJoin={handleJoin}
        onBackFromJoin={() => setShowJoinInput(false)}
      />

      <button
        onClick={onBack}
        style={{
          marginTop: "var(--space-8)",
          padding: "var(--space-2) var(--space-4)",
          fontSize: "0.75rem",
          background: "transparent",
          color: "var(--color-text-tertiary)",
          border: "1px solid var(--color-border-primary)",
          cursor: "pointer",
          fontFamily: "inherit",
          borderRadius: "4px",
        }}
      >
        Back to Single Player
      </button>
    </div>
  );
}
