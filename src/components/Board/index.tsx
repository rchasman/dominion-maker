import { useGame } from "../../context/GameContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { countVP, getAllCards } from "../../lib/board-utils";
import { OpponentBar } from "./OpponentBar";
import { ActionBar } from "./ActionBar";
import { DecisionPanel } from "./DecisionPanel";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";

interface BoardProps {
  onBackToHome?: () => void;
}

export function Board({ onBackToHome }: BoardProps) {
  const {
    gameState: state,
    selectedCards,
    handleCardClick: onCardClick,
    handleInPlayClick: onInPlayClick,
    handleBuyCard: onBuyCard,
    handleEndPhase: onEndPhase,
    handlePlayAllTreasures: onPlayAllTreasures,
    hasPlayableActions,
    hasTreasuresInHand,
    gameMode,
    setGameMode: onGameModeChange,
    startGame: onNewGame,
    isProcessing,
    modelSettings,
    setModelSettings: onModelSettingsChange,
  } = useGame();

  if (!state) return null;

  const isHumanTurn = state.activePlayer === "human";
  const canBuy = isHumanTurn && state.phase === "buy" && state.buys > 0;
  const opponent = state.players.ai;
  const human = state.players.human;
  const humanVP = countVP(getAllCards(human));
  const opponentVP = countVP(getAllCards(opponent));

  const getHint = () => {
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
        <OpponentBar
          opponent={opponent}
          isHumanTurn={isHumanTurn}
          gameMode={gameMode}
          onGameModeChange={onGameModeChange}
          phase={state.phase}
          subPhase={state.subPhase}
        />

        <div style={{ minBlockSize: 0, display: "flex", flexDirection: "column" }}>
          <Supply
            state={state}
            onBuyCard={onBuyCard}
            canBuy={canBuy}
            availableCoins={state.coins}
            pendingDecision={state.pendingDecision}
          />
        </div>

        {isHumanTurn && (
          <ActionBar
            state={state}
            hint={getHint()}
            hasTreasuresInHand={hasTreasuresInHand}
            onPlayAllTreasures={onPlayAllTreasures}
            onEndPhase={onEndPhase}
          />
        )}

        {state.pendingDecision && state.pendingDecision.type === "choose_card_from_options" && (
          <DecisionPanel
            pendingDecision={state.pendingDecision}
            onCardClick={onCardClick}
          />
        )}

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
          phase={state.phase}
          subPhase={state.subPhase}
        />
      </div>

      <GameSidebar
        state={state}
        isProcessing={isProcessing}
        gameMode={gameMode}
        modelSettings={modelSettings}
        onModelSettingsChange={onModelSettingsChange}
        onNewGame={onNewGame}
        onBackToHome={onBackToHome}
      />

      {state.gameOver && (
        <GameOverModal
          winner={state.winner}
          humanVP={humanVP}
          opponentVP={opponentVP}
          onNewGame={onNewGame}
        />
      )}
    </div>
  );
}
