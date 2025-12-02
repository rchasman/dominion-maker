import type { GameState, CardName } from "../types/game-state";
import { Supply } from "./Supply";
import { PlayerArea } from "./PlayerArea";

interface BoardProps {
  state: GameState;
  selectedCards: CardName[];
  onCardClick: (card: CardName, index: number) => void;
  onBuyCard: (card: CardName) => void;
  onEndPhase: () => void;
}

export function Board({
  state,
  selectedCards,
  onCardClick,
  onBuyCard,
  onEndPhase,
}: BoardProps) {
  const isHumanTurn = state.activePlayer === "human";
  const canBuy = isHumanTurn && state.phase === "buy" && state.buys > 0;

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Game Info Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          padding: "12px 16px",
          background: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <div>
          <strong>Turn {state.turn}</strong> | Phase:{" "}
          <span style={{ textTransform: "capitalize" }}>{state.phase}</span> |{" "}
          <span style={{ color: isHumanTurn ? "#4CAF50" : "#2196F3" }}>
            {isHumanTurn ? "Your Turn" : "AI Turn"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span>Actions: {state.actions}</span>
          <span>Buys: {state.buys}</span>
          <span>Coins: ${state.coins}</span>
          {isHumanTurn && !state.pendingDecision && (
            <button
              onClick={onEndPhase}
              style={{
                padding: "8px 16px",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              End {state.phase === "action" ? "Actions" : "Buys"}
            </button>
          )}
        </div>
      </div>

      {/* Supply */}
      <Supply
        state={state}
        onBuyCard={onBuyCard}
        canBuy={canBuy}
        availableCoins={state.coins}
      />

      {/* Trash pile */}
      {state.trash.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
            Trash ({state.trash.length})
          </h4>
          <div style={{ fontSize: "12px", color: "#999" }}>
            {state.trash.join(", ")}
          </div>
        </div>
      )}

      {/* Player Areas */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <PlayerArea
          player={state.players.ai}
          label="AI Opponent"
          isActive={state.activePlayer === "ai"}
          isHuman={false}
          selectedCards={[]}
        />

        <PlayerArea
          player={state.players.human}
          label="You"
          isActive={state.activePlayer === "human"}
          isHuman={true}
          selectedCards={selectedCards}
          onCardClick={onCardClick}
        />
      </div>

      {/* Game Log */}
      <div
        style={{
          marginTop: "24px",
          padding: "12px",
          background: "#f9f9f9",
          borderRadius: "8px",
          maxHeight: "150px",
          overflow: "auto",
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Game Log</h4>
        {state.log.slice(-10).map((entry, i) => (
          <div key={i} style={{ fontSize: "12px", color: "#666" }}>
            {entry}
          </div>
        ))}
      </div>

      {/* Game Over */}
      {state.gameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <h2>Game Over!</h2>
            <p style={{ fontSize: "24px" }}>
              {state.winner === "human" ? "You Win!" : "AI Wins!"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
