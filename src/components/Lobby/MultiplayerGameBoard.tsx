/**
 * Multiplayer Game Board
 *
 * Placeholder component that displays the multiplayer game state.
 * This will eventually be replaced with a proper Board integration.
 */
import { useMultiplayer } from "../../context/MultiplayerContext";

export function MultiplayerGameBoard() {
  const {
    gameState,
    multiplayerState,
    myPlayerIndex,
    isMyTurn,
    isHost,
    leaveRoom,
  } = useMultiplayer();

  if (!gameState || !multiplayerState) {
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
        Loading game...
      </div>
    );
  }

  const myPlayer = myPlayerIndex !== null ? `player${myPlayerIndex}` : null;
  const myPlayerState = myPlayer ? gameState.players[myPlayer as keyof typeof gameState.players] : null;
  const playerInfo = gameState.playerInfo;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-6)",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
        padding: "var(--space-4)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "2rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
        }}
      >
        MULTIPLAYER GAME
      </h1>

      {/* Turn indicator */}
      <div
        style={{
          padding: "var(--space-3) var(--space-6)",
          background: isMyTurn
            ? "rgba(34, 197, 94, 0.2)"
            : "var(--color-bg-secondary)",
          border: isMyTurn
            ? "2px solid rgba(34, 197, 94, 0.5)"
            : "1px solid var(--color-border-primary)",
          borderRadius: "8px",
          color: isMyTurn ? "#22c55e" : "var(--color-text-secondary)",
          fontSize: "1rem",
          fontWeight: 600,
        }}
      >
        {isMyTurn ? "Your Turn!" : `Waiting for ${playerInfo?.[gameState.activePlayer]?.name ?? gameState.activePlayer}...`}
      </div>

      {/* Game info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "8px",
        }}
      >
        <InfoBox label="Turn" value={gameState.turn.toString()} />
        <InfoBox label="Phase" value={gameState.phase} />
        <InfoBox label="Actions" value={gameState.actions.toString()} />
        <InfoBox label="Buys" value={gameState.buys.toString()} />
        <InfoBox label="Coins" value={gameState.coins.toString()} />
        <InfoBox label="Active" value={playerInfo?.[gameState.activePlayer]?.name ?? gameState.activePlayer} />
        <InfoBox label="Players" value={gameState.playerOrder?.length.toString() ?? "2"} />
        <InfoBox label="You" value={playerInfo?.[myPlayer as keyof typeof playerInfo]?.name ?? "?"} />
      </div>

      {/* My hand */}
      {myPlayerState && (
        <div
          style={{
            padding: "var(--space-4)",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "8px",
            minWidth: "400px",
          }}
        >
          <h3
            style={{
              margin: "0 0 var(--space-3) 0",
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
            }}
          >
            Your Hand ({myPlayerState.hand.length} cards)
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            {myPlayerState.hand.map((card: string, i: number) => (
              <span
                key={`${card}-${i}`}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  color: "var(--color-text-primary)",
                }}
              >
                {card}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Players */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
        }}
      >
        {gameState.playerOrder?.map((playerId) => {
          const info = playerInfo?.[playerId];
          const pState = gameState.players[playerId];
          const isActive = gameState.activePlayer === playerId;
          const isMe = playerId === myPlayer;

          return (
            <div
              key={playerId}
              style={{
                padding: "var(--space-3)",
                background: isMe
                  ? "rgba(34, 197, 94, 0.1)"
                  : "var(--color-bg-secondary)",
                border: isActive
                  ? "2px solid var(--color-gold)"
                  : isMe
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : "1px solid var(--color-border-primary)",
                borderRadius: "8px",
                minWidth: "120px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: isActive
                    ? "var(--color-gold)"
                    : "var(--color-text-primary)",
                  fontWeight: 600,
                  marginBottom: "var(--space-2)",
                }}
              >
                {info?.name ?? playerId}
                {isMe && " (you)"}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Hand: {pState?.hand.length ?? 0} | Deck: {pState?.deck.length ?? 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug info */}
      {isHost && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
          }}
        >
          You are the host
        </div>
      )}

      {/* Leave button */}
      <button
        onClick={leaveRoom}
        style={{
          marginTop: "var(--space-4)",
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
        Leave Game
      </button>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "0.625rem",
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1rem",
          color: "var(--color-text-primary)",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}
