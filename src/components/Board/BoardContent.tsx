import { lazy, Suspense } from "preact/compat";
import { useCallback } from "preact/hooks";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { formatPlayerName, getPlayerColor } from "../../lib/board-utils";
import {
  players$,
  pendingUndo$,
  approveUndo$,
  denyUndo$,
  isHost$,
  isSpectator$,
  localPlayerId$ as localPlayerId$$,
} from "../../context/game-signals";
import { GameSidebar } from "./GameSidebar";
import { DominionLogRows } from "./DominionLogRows";
import { TurnStatusIndicator, type TurnStatus } from "./TurnStatusIndicator";
import { getSubPhase } from "../../lib/state-helpers";
import { GameOverModal } from "./GameOverModal";
import { UndoRequestModal } from "./UndoRequestModal";
import type { CardName, GameState, PlayerId } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { ControllerConfig, ControllerKind, Seats } from "../../core/seats";
import { HUMAN_SEAT, isHumanSeat } from "../../core/seats";
import type { PlayerStrategyData } from "../../types/player-strategy";
import { SeatSelector } from "../SeatSelector";
import { dominionModule } from "../../dominion/module";
import { SEAT_PRESETS } from "../../context/seat-presets";
import {
  SEAT_PRESET_NAMES,
  presetOf,
  saveSeatPreset,
  type SeatPreset,
} from "../../core/seat-presets";
import { setSeats$ } from "../../context/game-signals";
import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { MainPlayerArea } from "./MainPlayerArea";
import type { BoardState } from "./boardStateHelpers";
import type { ComplexDecisionData } from "./hooks";
import { useAnimationSafe } from "../../animation";
import { isDecisionChoice } from "../../types/pending-choice";
import { run } from "../../lib/run";

const ANIMATION_DURATION = {
  BUY_TO_DISCARD_MS: 300,
  PLAY_TREASURE_MS: 200,
} as const;

const CARD_ID_SKIP_PARTS = 2;

const EventDevtools = lazy(() =>
  import("../EventDevtools").then(m => ({ default: m.EventDevtools })),
);

interface BoardContentProps {
  boardState: BoardState;
  game: {
    events: GameEvent[];
    isProcessing: boolean;
    appMode: "local" | "multiplayer";
    seats: Seats;
    setSeat: ((player: string, config: ControllerConfig) => void) | undefined;
    playerStrategies: PlayerStrategyData;
    buyCard: (card: CardName) => void;
    playAllTreasures: () => void;
    endPhase: () => void;
    hasTreasuresInHand: boolean;
    gameOver: boolean;
    winnerId: PlayerId | undefined;
  };
  isPreviewMode: boolean;
  previewError: string | null;
  selectedCardIndices: number[];
  complexDecisionData: ComplexDecisionData | null;
  showDevtools: boolean;
  onToggleDevtools: () => void;
  onNewGame: () => void;
  onBackToHome?: () => void;
  onRequestUndo: (eventId: string) => void;
  onScrub: (eventId: string | null) => void;
  onCardClick?: ((card: CardName, index: number) => void) | undefined;
  onInPlayClick?: ((card: CardName) => void) | undefined;
  onPlayAllTreasures?: (() => void) | undefined;
  onEndPhase?: (() => void) | undefined;
  onConfirmDecision?: ((data: ComplexDecisionData | null) => void) | undefined;
  onSkipDecision?: (() => void) | undefined;
  onRevealReaction?: (card: CardName) => void;
  onDeclineReaction?: () => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
}

interface SupplyAreaProps {
  displayState: GameState;
  onBuyCard?: ((card: CardName) => void) | undefined;
  canBuy: boolean;
  isPlayerActive: boolean;
  hasTreasuresInHand: boolean;
  onPlayAllTreasures?: (() => void) | undefined;
  onEndPhase?: (() => void) | undefined;
  selectedCardIndices: number[];
  onConfirmDecision?: ((data: ComplexDecisionData | null) => void) | undefined;
  onSkipDecision?: (() => void) | undefined;
  complexDecisionData: ComplexDecisionData | null;
}

function SupplyArea({
  displayState,
  onBuyCard,
  canBuy,
  isPlayerActive,
  hasTreasuresInHand,
  onPlayAllTreasures,
  onEndPhase,
  selectedCardIndices,
  onConfirmDecision,
  onSkipDecision,
  complexDecisionData,
}: SupplyAreaProps) {
  return (
    <Supply
      state={displayState}
      {...(onBuyCard !== undefined && { onBuyCard })}
      canBuy={canBuy}
      availableCoins={displayState.coins}
      pendingChoice={
        isDecisionChoice(displayState.pendingChoice)
          ? displayState.pendingChoice
          : null
      }
      isPlayerActive={isPlayerActive}
      hasTreasuresInHand={hasTreasuresInHand}
      {...(onPlayAllTreasures !== undefined && { onPlayAllTreasures })}
      {...(onEndPhase !== undefined && { onEndPhase })}
      selectedCardIndices={selectedCardIndices}
      {...(onConfirmDecision !== undefined && { onConfirmDecision })}
      {...(onSkipDecision !== undefined && { onSkipDecision })}
      complexDecisionData={complexDecisionData}
    />
  );
}

export function BoardContent({
  boardState,
  game,
  isPreviewMode,
  previewError,
  selectedCardIndices,
  complexDecisionData,
  showDevtools,
  onToggleDevtools,
  onNewGame,
  onBackToHome,
  onRequestUndo,
  onScrub,
  onCardClick,
  onInPlayClick,
  onPlayAllTreasures,
  onEndPhase,
  onConfirmDecision,
  onSkipDecision,
  onRevealReaction,
  onDeclineReaction,
  onComplexDecisionChange,
}: BoardContentProps) {
  const {
    displayState,
    localPlayerId,
    opponentPlayerId,
    isLocalPlayerTurn,
    canLocalPlayerAct,
    canBuy,
    opponent,
    localPlayer,
    localPlayerVP,
    opponentVP,
    isOpponentAI,
    isLocalPlayerAI,
  } = boardState;

  const players = players$.value;
  const pendingUndo = pendingUndo$.value;
  const approveUndo = approveUndo$.value;
  const denyUndo = denyUndo$.value;
  const contextLocalPlayerId = localPlayerId$$.value;
  const animation = useAnimationSafe();

  // Try to get opponent name from players list (multiplayer)
  const opponentPlayerName = players?.find(
    p => p.id === opponentPlayerId,
  )?.name;
  const opponentDisplayName = run(() => {
    if (opponentPlayerName) {
      return isOpponentAI ? `${opponentPlayerName} (AI)` : opponentPlayerName;
    }
    return formatPlayerName(opponentPlayerId, isOpponentAI, {
      gameState: displayState,
    });
  });

  const setSeat = game.setSeat;
  const setSeats = setSeats$.value;
  const onPresetChange =
    game.appMode === "local" && setSeats !== null
      ? (preset: SeatPreset) => {
          setSeats(SEAT_PRESETS[preset].seats(displayState.playerOrder));
          saveSeatPreset(preset);
        }
      : null;
  const presets = {
    names: SEAT_PRESET_NAMES,
    label: (preset: SeatPreset) => SEAT_PRESETS[preset].name,
    active: presetOf(game.seats),
    ...(onPresetChange !== null && { onChange: onPresetChange }),
  };
  const subPhase = getSubPhase(displayState);
  const isActiveSeatLocal = displayState.activePlayerId === localPlayerId;
  const turnStatus: TurnStatus = run(() => {
    if (
      (game.isProcessing || subPhase === "opponent_decision") &&
      !isActiveSeatLocal
    ) {
      return "thinking";
    }
    if (
      !game.isProcessing &&
      isActiveSeatLocal &&
      subPhase !== "opponent_decision"
    ) {
      return "yours";
    }
    return null;
  });
  const isHost = isHost$.value;
  const isLocalGame = game.appMode === "local";
  // Single player: you are always the human, so your own seat has no selector.
  // Lobby rooms: Manual or LLM; Engine stays a single-player option.
  const seatOptions: readonly ControllerKind[] = isLocalGame
    ? ["heuristic", "llm"]
    : ["human", "llm"];
  const showsSelector = (playerId: PlayerId): boolean =>
    !isLocalGame || !isHumanSeat(game.seats[playerId]);
  const canEditSeat = (playerId: PlayerId): boolean =>
    isLocalGame ||
    playerId === contextLocalPlayerId ||
    (isHost && !isHumanSeat(game.seats[playerId]));
  const seatControl =
    setSeat === undefined || isPreviewMode
      ? null
      : (playerId: PlayerId) =>
          showsSelector(playerId) ? (
            <SeatSelector
              playerId={playerId}
              config={game.seats[playerId] ?? HUMAN_SEAT}
              options={seatOptions}
              defaultLlm={dominionModule.defaultLlmSeat}
              onChange={config => setSeat(playerId, config)}
              disabled={!canEditSeat(playerId)}
            />
          ) : null;

  // Wrap buyCard to add flying animation from supply to discard
  const animatedBuyCard = useCallback(
    (card: CardName) => {
      // Find the supply card element
      const cardElement = document.querySelector(
        `[data-card-id="supply-${card}"]`,
      );
      const fromRect = cardElement?.getBoundingClientRect();

      // Execute the buy
      game.buyCard(card);

      // Queue animation
      if (animation && fromRect) {
        animation.queueAnimation({
          cardName: card,
          fromRect,
          toZone: "discard",
          duration: ANIMATION_DURATION.BUY_TO_DISCARD_MS,
        });
      }
    },
    [game, animation],
  );

  // Wrap playAllTreasures to animate all treasures flying to inPlay
  const animatedPlayAllTreasures = useCallback(() => {
    if (!onPlayAllTreasures) return;

    // Find all treasure cards in main player's hand (not opponent's)
    // Main player cards: hand-{index}-{card}, Opponent cards: hand-opponent-{index}-{card}
    const treasureElements = document.querySelectorAll(
      '[data-card-id^="hand-"]:not([data-card-id^="hand-opponent"])',
    );
    const filteredElements = Array.from(treasureElements).filter(el => {
      const cardId = el.getAttribute("data-card-id") ?? "";
      return (
        cardId.includes("Copper") ||
        cardId.includes("Silver") ||
        cardId.includes("Gold")
      );
    });

    const cardRects = filteredElements
      .map(el => {
        const cardId = el.getAttribute("data-card-id");
        if (!cardId) return null;
        // Format is hand-{index}-{cardName}, so skip first two parts
        const card = cardId
          .split("-")
          .slice(CARD_ID_SKIP_PARTS)
          .join("-") as CardName;
        return { card, rect: el.getBoundingClientRect() };
      })
      .filter(
        (item): item is { card: CardName; rect: DOMRect } => item !== null,
      );

    // Execute the action
    onPlayAllTreasures();

    // Queue animations all at once (no stagger to avoid flash)
    if (animation) {
      cardRects.map(({ card, rect }) =>
        animation.queueAnimation({
          cardName: card,
          fromRect: rect,
          toZone: "inPlay",
          duration: ANIMATION_DURATION.PLAY_TREASURE_MS,
        }),
      );
    }
  }, [onPlayAllTreasures, animation]);

  return (
    <BoardLayout isPreviewMode={isPreviewMode} previewError={previewError}>
      <GameAreaLayout isPreviewMode={isPreviewMode}>
        <PlayerArea
          player={opponent}
          label={opponentDisplayName}
          vpCount={opponentVP}
          isActive={!isLocalPlayerTurn}
          showCards={true}
          selectedCardIndices={[]}
          inverted={true}
          phase={displayState.phase}
          actions={displayState.actions}
          playerId={opponentPlayerId}
          turnHistory={displayState.turnHistory}
          {...(game.playerStrategies[opponentPlayerId] !== undefined && {
            playerStrategy: game.playerStrategies[opponentPlayerId],
          })}
          gameState={displayState}
        />

        <SupplyArea
          displayState={displayState}
          {...(!isPreviewMode &&
            animatedBuyCard !== undefined && { onBuyCard: animatedBuyCard })}
          canBuy={isPreviewMode ? false : canBuy}
          isPlayerActive={canLocalPlayerAct}
          hasTreasuresInHand={game.hasTreasuresInHand}
          onPlayAllTreasures={animatedPlayAllTreasures}
          {...(onEndPhase !== undefined && { onEndPhase })}
          selectedCardIndices={selectedCardIndices}
          {...(onConfirmDecision !== undefined && { onConfirmDecision })}
          {...(onSkipDecision !== undefined && { onSkipDecision })}
          complexDecisionData={complexDecisionData}
        />

        <MainPlayerArea
          localPlayer={localPlayer}
          {...(seatControl !== null && {
            headerControl: seatControl(localPlayerId),
          })}
          localPlayerVP={localPlayerVP}
          isLocalPlayerTurn={isLocalPlayerTurn}
          isLocalPlayerAI={isLocalPlayerAI}
          selectedCardIndices={selectedCardIndices}
          isPreviewMode={isPreviewMode}
          displayState={displayState}
          {...(onCardClick !== undefined && { onCardClick })}
          {...(onInPlayClick !== undefined && { onInPlayClick })}
          onComplexDecisionChange={onComplexDecisionChange}
          {...(onRevealReaction !== undefined && { onRevealReaction })}
          {...(onDeclineReaction !== undefined && { onDeclineReaction })}
        />
      </GameAreaLayout>

      <GameSidebar
        log={
          <DominionLogRows
            log={displayState.log}
            events={game.events}
            onRequestUndo={onRequestUndo}
          />
        }
        logEntryCount={displayState.log.length}
        turnStatus={
          <TurnStatusIndicator
            status={turnStatus}
            color={getPlayerColor(displayState.activePlayerId)}
          />
        }
        appMode={game.appMode}
        seats={game.seats}
        {...(game.setSeat !== undefined && { onSeatChange: game.setSeat })}
        presets={presets}
        isSpectator={isSpectator$.value}
        {...(onNewGame !== undefined && { onNewGame })}
        {...(onBackToHome !== undefined && { onBackToHome })}
      />

      {game.gameOver && game.winnerId && (
        <GameOverModal
          winnerId={game.winnerId}
          localPlayerId={localPlayerId}
          opponentPlayerId={opponentPlayerId}
          isLocalPlayerAI={isLocalPlayerAI}
          isOpponentAI={isOpponentAI}
          localPlayerVP={localPlayerVP}
          opponentVP={opponentVP}
          turnCount={displayState.turn}
          gameState={displayState}
          onNewGame={onNewGame}
        />
      )}

      {pendingUndo &&
        approveUndo &&
        denyUndo &&
        !game.gameOver &&
        contextLocalPlayerId !== pendingUndo.byPlayer && (
          <UndoRequestModal
            requestId={pendingUndo.requestId}
            byPlayerName={
              players?.find(p => p.id === pendingUndo.byPlayer)?.name ||
              pendingUndo.byPlayer
            }
            toEventId={pendingUndo.toEventId}
            events={game.events}
            onApprove={approveUndo}
            onDeny={denyUndo}
          />
        )}

      <Suspense fallback={null}>
        <EventDevtools
          events={game.events}
          isOpen={showDevtools}
          onToggle={onToggleDevtools}
          onBranchFrom={onRequestUndo}
          onScrub={onScrub}
        />
      </Suspense>
    </BoardLayout>
  );
}
