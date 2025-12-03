import { useRef, useEffect } from "react";
import type { GameState, CardName, LogEntry as LogEntryType } from "../types/game-state";
import type { GameMode } from "../types/game-mode";
import { Supply } from "./Supply";
import { PlayerArea } from "./PlayerArea";
import { Card } from "./Card";
import { LogEntry } from "./LogEntry";
import { LLMLog, type LLMLogEntry } from "./LLMLog";
import { CARDS } from "../data/cards";

interface BoardProps {
  state: GameState;
  selectedCards: CardName[];
  onCardClick: (card: CardName, index: number) => void;
  onInPlayClick: (card: CardName, index: number) => void;
  onBuyCard: (card: CardName) => void;
  onEndPhase: () => void;
  onPlayAllTreasures: () => void;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  llmLogs: LLMLogEntry[];
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  onNewGame: () => void;
  isProcessing: boolean;
}

function countVP(cards: CardName[]): number {
  let vp = 0;
  for (const card of cards) {
    const def = CARDS[card];
    if (def.vp === "variable") {
      vp += Math.floor(cards.length / 10);
    } else if (typeof def.vp === "number") {
      vp += def.vp;
    }
  }
  return vp;
}

function getAllCards(player: { deck: CardName[]; hand: CardName[]; discard: CardName[]; inPlay: CardName[] }): CardName[] {
  return [...player.deck, ...player.hand, ...player.discard, ...player.inPlay];
}

// Aggregate consecutive identical log entries for display
function aggregateLogEntries(log: LogEntryType[]): LogEntryType[] {
  if (log.length === 0) return [];

  const result: LogEntryType[] = [];
  let i = 0;

  while (i < log.length) {
    const current = log[i];

    // Only aggregate play-treasure, play-action, buy-card, and gain-card entries
    if (
      current.type === "play-treasure" ||
      current.type === "play-action" ||
      current.type === "buy-card" ||
      current.type === "gain-card"
    ) {
      // Count consecutive identical entries
      let count = 1;
      let totalCoins = current.type === "play-treasure" ? current.coins : 0;
      let totalVP = current.type === "buy-card" && current.vp !== undefined ? current.vp : 0;
      const allChildren: LogEntryType[] = [];

      // Collect children from first entry
      if (current.children) {
        allChildren.push(...(current.children as LogEntryType[]));
      }

      // Look ahead for matching entries
      while (i + count < log.length) {
        const next = log[i + count];

        // Check if next entry matches current one
        const matches =
          next.type === current.type &&
          ("player" in next && "player" in current && next.player === current.player) &&
          ("card" in next && "card" in current && next.card === current.card);

        if (!matches) break;

        // Aggregate values
        if (next.type === "play-treasure") {
          totalCoins += next.coins;
        }
        if (next.type === "buy-card" && next.vp !== undefined) {
          totalVP += next.vp;
        }

        // Collect children from subsequent entries
        if (next.children) {
          allChildren.push(...(next.children as LogEntryType[]));
        }

        count++;
      }

      // Create aggregated entry
      if (count > 1) {
        // Recursively aggregate children
        const aggregatedChildren = allChildren.length > 0 ? aggregateLogEntries(allChildren) : [];

        if (current.type === "play-treasure") {
          result.push({
            ...current,
            coins: totalCoins,
            children: [{ type: "text", message: `${count}x` }],
          });
        } else if (current.type === "buy-card") {
          result.push({
            ...current,
            vp: totalVP !== 0 ? totalVP : undefined,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
          });
        } else {
          // play-action or gain-card
          result.push({
            ...current,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
          });
        }
      } else {
        result.push(current);
      }

      i += count;
    } else {
      // Don't aggregate other entry types
      result.push(current);
      i++;
    }
  }

  return result;
}

export function Board({
  state,
  selectedCards,
  onCardClick,
  onInPlayClick,
  onBuyCard,
  onEndPhase,
  onPlayAllTreasures,
  hasPlayableActions,
  hasTreasuresInHand,
  llmLogs,
  gameMode,
  onGameModeChange,
  onNewGame,
  isProcessing,
}: BoardProps) {
  const isHumanTurn = state.activePlayer === "human";
  const canBuy = isHumanTurn && state.phase === "buy" && state.buys > 0;
  const opponent = state.players.ai;
  const human = state.players.human;
  const gameLogScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll game log to bottom when new entries are added or spinner appears
  useEffect(() => {
    if (gameLogScrollRef.current) {
      requestAnimationFrame(() => {
        if (gameLogScrollRef.current) {
          gameLogScrollRef.current.scrollTop = gameLogScrollRef.current.scrollHeight;
        }
      });
    }
  }, [state.log, isProcessing]);

  const opponentVP = countVP(getAllCards(opponent));
  const humanVP = countVP(getAllCards(human));

  const getHint = () => {
    // Pending decision takes priority
    if (state.pendingDecision && state.pendingDecision.player === "human") {
      return state.pendingDecision.prompt;
    }

    if (!isHumanTurn) return "Opponent is playing...";
    if (state.phase === "action") {
      if (hasPlayableActions) return "Click an Action card to play it";
      return "";
    }
    if (state.phase === "buy") {
      const hasInPlayTreasures = human.inPlay.length > 0;
      if (state.coins === 0 && hasTreasuresInHand) {
        return "Play treasures to get coins";
      }
      if (hasInPlayTreasures) {
        return "Click played treasures to take back";
      }
      return "";
    }
    return "";
  };

  const hint = getHint();

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 20rem",
      inlineSize: "100vw",
      blockSize: "100dvh",
      overflow: "hidden",
      background: "var(--color-bg-primary)"
    }}>
      {/* Main game area */}
      <div style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto auto",
        rowGap: "var(--space-3)",
        padding: "var(--space-5)",
        minInlineSize: 0,
        overflow: "hidden"
      }}>
        {/* Opponent section at top */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-3) var(--space-4)",
          background: !isHumanTurn
            ? "linear-gradient(180deg, rgba(100, 181, 246, 0.15) 0%, rgba(100, 181, 246, 0.05) 100%)"
            : "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
          border: !isHumanTurn ? "1px solid var(--color-ai)" : "1px solid var(--color-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <strong style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>Opponent</strong>
              {!isHumanTurn && (
                <span style={{ fontSize: "0.5rem", background: "var(--color-ai)", color: "#fff", padding: "2px 6px", fontWeight: 600 }}>
                  PLAYING
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              <span>Deck: <strong style={{ color: "var(--color-gold)" }}>{opponent.deck.length}</strong></span>
              <span>Hand: <strong style={{ color: "var(--color-gold)" }}>{opponent.hand.length}</strong></span>
              <span>Discard: <strong style={{ color: "var(--color-gold)" }}>{opponent.discard.length}</strong></span>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05rem" }}>
                Mode:
              </span>
              <button
                onClick={() => onGameModeChange("engine")}
                style={{
                  padding: "3px 8px",
                  fontSize: "0.65rem",
                  fontWeight: gameMode === "engine" ? 700 : 400,
                  background: gameMode === "engine" ? "var(--color-victory-dark)" : "transparent",
                  color: gameMode === "engine" ? "#fff" : "var(--color-text-secondary)",
                  border: "1px solid",
                  borderColor: gameMode === "engine" ? "var(--color-victory)" : "var(--color-border-secondary)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05rem",
                  fontFamily: "inherit",
                  borderRadius: "3px",
                }}
              >
                Engine
              </button>
              <button
                onClick={() => onGameModeChange("hybrid")}
                style={{
                  padding: "3px 8px",
                  fontSize: "0.65rem",
                  fontWeight: gameMode === "hybrid" ? 700 : 400,
                  background: gameMode === "hybrid" ? "var(--color-victory-dark)" : "transparent",
                  color: gameMode === "hybrid" ? "#fff" : "var(--color-text-secondary)",
                  border: "1px solid",
                  borderColor: gameMode === "hybrid" ? "var(--color-victory)" : "var(--color-border-secondary)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05rem",
                  fontFamily: "inherit",
                  borderRadius: "3px",
                }}
              >
                Hybrid
              </button>
              <button
                onClick={() => onGameModeChange("llm")}
                style={{
                  padding: "3px 8px",
                  fontSize: "0.65rem",
                  fontWeight: gameMode === "llm" ? 700 : 400,
                  background: gameMode === "llm" ? "var(--color-victory-dark)" : "transparent",
                  color: gameMode === "llm" ? "#fff" : "var(--color-text-secondary)",
                  border: "1px solid",
                  borderColor: gameMode === "llm" ? "var(--color-victory)" : "var(--color-border-secondary)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05rem",
                  fontFamily: "inherit",
                  borderRadius: "3px",
                }}
              >
                LLM
              </button>
            </div>
          </div>
          <div style={{
            fontSize: "0.875rem",
            color: "var(--color-victory)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}>
            <span style={{ color: "var(--color-text-secondary)", fontWeight: 400, fontSize: "0.75rem" }}>VP:</span>
            {opponentVP}
          </div>
        </div>

        {/* Supply - takes the space */}
        <div style={{ minBlockSize: 0, display: "flex", flexDirection: "column" }}>
          <Supply
            state={state}
            onBuyCard={onBuyCard}
            canBuy={canBuy}
            availableCoins={state.coins}
            pendingDecision={state.pendingDecision}
          />
        </div>

        {/* Action bar - contextual controls above player section */}
        {isHumanTurn && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--space-3) var(--space-4)",
            background: "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
            border: "1px solid var(--color-border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", fontSize: "0.8125rem" }}>
              <span style={{
                textTransform: "uppercase",
                color: "#fff",
                fontSize: "0.625rem",
                background: state.phase === "action" ? "var(--color-action-phase)" : "var(--color-buy-phase)",
                padding: "var(--space-1) var(--space-3)",
                fontWeight: 600,
              }}>
                {state.phase} phase
              </span>
              <span style={{ color: "var(--color-text-primary)" }}>
                Actions: <strong style={{ color: "var(--color-gold)" }}>{state.actions}</strong>
              </span>
              <span style={{ color: "var(--color-text-primary)" }}>
                Buys: <strong style={{ color: "var(--color-gold)" }}>{state.buys}</strong>
              </span>
              <span style={{ color: "var(--color-text-primary)" }}>
                Coins: <strong style={{ color: "var(--color-gold-bright)" }}>${state.coins}</strong>
              </span>
              {hint && <span style={{
                color: state.pendingDecision ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
                fontStyle: "italic",
                fontSize: "0.75rem",
              }}>{hint}</span>}
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {state.phase === "buy" && hasTreasuresInHand && (
                <button
                  onClick={onPlayAllTreasures}
                  disabled={!!(state.pendingDecision && !state.pendingDecision.canSkip)}
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    background: "linear-gradient(180deg, var(--color-gold-darker) 0%, var(--color-gold-dark) 100%)",
                    color: "var(--color-bg-primary)",
                    border: "1px solid var(--color-gold-bright)",
                    cursor: (state.pendingDecision && !state.pendingDecision.canSkip) ? "not-allowed" : "pointer",
                    opacity: (state.pendingDecision && !state.pendingDecision.canSkip) ? 0.5 : 1,
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    fontFamily: "inherit",
                  }}
                >
                  Play Treasures
                </button>
              )}
              <button
                onClick={onEndPhase}
                disabled={!!(state.pendingDecision && !state.pendingDecision.canSkip)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: (state.pendingDecision && state.pendingDecision.canSkip)
                    ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                    : state.phase === "action"
                    ? "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)"
                    : "linear-gradient(180deg, #555 0%, #333 100%)",
                  color: "#fff",
                  border: (state.pendingDecision && state.pendingDecision.canSkip)
                    ? "1px solid #fbbf24"
                    : state.phase === "action" ? "1px solid var(--color-victory)" : "1px solid #666",
                  cursor: (state.pendingDecision && !state.pendingDecision.canSkip) ? "not-allowed" : "pointer",
                  opacity: (state.pendingDecision && !state.pendingDecision.canSkip) ? 0.5 : 1,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                }}
              >
                {(state.pendingDecision && state.pendingDecision.canSkip)
                  ? "Skip"
                  : state.phase === "action" ? "Skip to Buy" : "End Turn"}
              </button>
            </div>
          </div>
        )}

        {/* Decision Panel for text-based choices (Sentry, Library, etc.) */}
        {state.pendingDecision && state.pendingDecision.type === "choose_card_from_options" && (
          <div style={{
            padding: "var(--space-4)",
            background: "rgba(255, 215, 0, 0.15)",
            border: "2px solid var(--color-gold)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}>
            <div style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--color-gold-bright)",
              textAlign: "center",
            }}>
              {state.pendingDecision.prompt}
            </div>
            <div style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: "center",
              flexWrap: "wrap",
            }}>
              {state.pendingDecision.options.map((option) => {
                const optionStr = option as string;
                return (
                  <button
                    key={option}
                    onClick={() => onCardClick(option as CardName, 0)}
                    style={{
                      padding: "var(--space-3) var(--space-6)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      background: optionStr === "Trash"
                        ? "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)"
                        : optionStr === "Discard"
                        ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                        : optionStr === "Skip"
                        ? "linear-gradient(180deg, #6b7280 0%, #4b5563 100%)"
                        : "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05rem",
                      fontFamily: "inherit",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* You - fixed at bottom */}
        <PlayerArea
          player={human}
          label="You"
          vpCount={humanVP}
          isActive={isHumanTurn}
          isHuman={true}
          selectedCards={selectedCards}
          onCardClick={onCardClick}
          onInPlayClick={state.phase === "buy" ? onInPlayClick : undefined}
          pendingDecision={state.pendingDecision}
        />
      </div>

      {/* Sidebar */}
      <div
        style={{
          borderInlineStart: "1px solid var(--color-border)",
          background: "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Game Log - scrollable */}
        <div
          ref={gameLogScrollRef}
          style={{
            flex: "3",
            minBlockSize: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "var(--space-5)",
            fontSize: "0.6875rem",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        >
          <div style={{
            fontWeight: 600,
            marginBlockEnd: "var(--space-4)",
            textTransform: "uppercase",
            fontSize: "0.625rem",
            color: "var(--color-gold)",
            borderBlockEnd: "1px solid var(--color-border)",
            paddingBlockEnd: "var(--space-3)",
          }}>
            Game Log
          </div>
          {aggregateLogEntries(state.log).map((entry, i) => (
            <div key={i} style={{ color: "var(--color-text-secondary)", marginBlockEnd: "var(--space-2)", lineHeight: 1.4 }}>
              <LogEntry entry={entry} />
            </div>
          ))}
          {isProcessing && state.activePlayer === "ai" && (
            <div
              style={{
                color: "var(--color-ai)",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBlockStart: "var(--space-2)",
                animation: "pulse 1.5s ease-in-out infinite",
                fontStyle: "italic",
              }}
            >
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⚙</span>
              <span>AI thinking...</span>
            </div>
          )}
        </div>

        {/* LLM Debug Log - always visible, shows mode info */}
        <div style={{
          flex: "2",
          minBlockSize: 0,
          display: "flex",
          flexDirection: "column",
          borderBlockStart: "1px solid var(--color-border)",
          background: "var(--color-bg-primary)",
          overflow: "hidden",
        }}>
          <LLMLog entries={llmLogs} gameMode={gameMode} />
        </div>

        {/* Game status at bottom of sidebar */}
        <div style={{
          padding: "var(--space-4)",
          borderBlockStart: "1px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBlockEnd: "var(--space-3)",
          }}>
            <span style={{ color: "var(--color-gold)", fontWeight: 600, fontSize: "0.875rem" }}>
              Turn {state.turn}
            </span>
            <span style={{
              fontSize: "0.625rem",
              color: isHumanTurn ? "var(--color-human)" : "var(--color-ai)",
              fontWeight: 600,
            }}>
              {isHumanTurn ? "Your Turn" : "Opponent"}
            </span>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--color-text-secondary)",
          }}>
            <span>You: <strong style={{ color: "var(--color-victory)" }}>{humanVP} VP</strong></span>
            <span>Opp: <strong style={{ color: "var(--color-ai)" }}>{opponentVP} VP</strong></span>
          </div>

          {/* New Game Button */}
          <button
            onClick={onNewGame}
            style={{
              marginBlockStart: "var(--space-3)",
              padding: "var(--space-2)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              fontFamily: "inherit",
              borderRadius: "4px",
              width: "100%",
            }}
            title="Start a new game"
          >
            ↻ New Game
          </button>
        </div>
      </div>

      {/* Game Over */}
      {state.gameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgb(0 0 0 / 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
              padding: "var(--space-10) 3.75rem",
              textAlign: "center",
              border: "2px solid var(--color-gold)",
              boxShadow: "var(--shadow-game-over)",
            }}
          >
            <h2 style={{ margin: "0 0 var(--space-6) 0", color: "var(--color-gold)", fontSize: "1.75rem" }}>Game Over</h2>
            <p style={{ fontSize: "1.375rem", margin: 0, color: state.winner === "human" ? "var(--color-victory)" : "#ef5350" }}>
              {state.winner === "human" ? "Victory!" : "Defeat"}
            </p>
            <div style={{ marginBlockStart: "var(--space-4)", fontSize: "1rem", color: "var(--color-text-secondary)" }}>
              You: {humanVP} VP | Opponent: {opponentVP} VP
            </div>
            <button
              onClick={onNewGame}
              style={{
                marginBlockStart: "var(--space-6)",
                padding: "var(--space-4) var(--space-8)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
                color: "#fff",
                border: "2px solid var(--color-victory)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              New Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
