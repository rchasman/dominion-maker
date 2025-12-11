import type { GameState, CardName } from "../types/game-state";
import type { CommandResult } from "./types";
import type { GameEvent, PlayerId } from "../events/types";
import { shuffle } from "../lib/game-utils";
import { generateEventId } from "../events/id-generator";
import { EventBuilder } from "../events/event-builder";
import {
  GAME_CONSTANTS,
  selectRandomKingdomCards,
  calculateSupply,
  getNextPlayer,
  checkGameOver,
  createResourceEvents,
} from "./handle-helpers";
import { STARTING_DECK } from "../data/supply-constants";
import { createDrawEvents } from "../cards/effect-types";
import { applyEvents } from "../events/apply";

export function handleStartGame(
  _state: GameState,
  players: PlayerId[],
  kingdomCards?: CardName[],
  seed?: number,
): CommandResult {
  // Select kingdom cards if not provided
  const selectedKingdom = kingdomCards || selectRandomKingdomCards();

  // Calculate supply based on player count
  const supply = calculateSupply(players.length, selectedKingdom);

  // Root cause - initializing game
  const rootEventId = generateEventId();
  const events: GameEvent[] = [
    {
      type: "GAME_INITIALIZED",
      players,
      kingdomCards: selectedKingdom,
      supply,
      seed,
      id: rootEventId,
    },
  ];

  // Deal starting decks (7 Copper, 3 Estate per official rules)
  const startingDeck: CardName[] = [
    ...Array(STARTING_DECK.COPPER).fill("Copper"),
    ...Array(STARTING_DECK.ESTATE).fill("Estate"),
  ];

  const playerSetupEvents = players.flatMap(player => {
    const shuffledDeck = shuffle([...startingDeck]);
    const initialHand = shuffledDeck.slice(-GAME_CONSTANTS.INITIAL_HAND_SIZE);
    return [
      {
        type: "INITIAL_DECK_DEALT" as const,
        player,
        cards: shuffledDeck,
        id: generateEventId(),
        causedBy: rootEventId,
      },
      {
        type: "INITIAL_HAND_DRAWN" as const,
        player,
        cards: initialHand,
        id: generateEventId(),
        causedBy: rootEventId,
      },
    ];
  });

  // Start turn 1
  const turnStartId = generateEventId();

  // Add initial resources as explicit events for log clarity
  return {
    ok: true,
    events: [
      ...events,
      ...playerSetupEvents,
      {
        type: "TURN_STARTED",
        turn: 1,
        player: players[0],
        id: turnStartId,
      },
      ...createResourceEvents(
        [
          { type: "ACTIONS_MODIFIED", delta: 1 },
          { type: "BUYS_MODIFIED", delta: 1 },
        ],
        turnStartId,
      ),
    ],
  };
}

export function handleEndPhase(
  state: GameState,
  player: PlayerId,
): CommandResult {
  if (state.phase === "action") {
    // Transition to buy phase
    const phaseEventId = generateEventId();
    return {
      ok: true,
      events: [
        {
          type: "PHASE_CHANGED",
          phase: "buy",
          id: phaseEventId,
        },
      ],
    };
  }

  if (state.phase === "buy") {
    // End turn - cleanup and start next player's turn
    const playerState = state.players[player];
    if (!playerState) {
      return { ok: false, error: "Player not found" };
    }

    // Root cause - ending turn (add explicit TURN_ENDED event)
    const endTurnId = generateEventId();
    const turnEndedEvent: GameEvent = {
      type: "TURN_ENDED",
      player: player,
      turn: state.turn,
      id: endTurnId,
    };

    // Discard hand and in-play cards (atomic events)
    const handDiscardEvents: GameEvent[] = playerState.hand.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "hand" as const,
      id: generateEventId(),
      causedBy: endTurnId,
    }));

    const inPlayDiscardEvents: GameEvent[] = playerState.inPlay.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "inPlay" as const,
      id: generateEventId(),
      causedBy: endTurnId,
    }));

    const cleanupEvents = [
      turnEndedEvent,
      ...handDiscardEvents,
      ...inPlayDiscardEvents,
    ];

    // Draw 5 new cards
    const drawEvents = createDrawEvents(
      player,
      applyEvents(state, cleanupEvents).players[player],
      GAME_CONSTANTS.INITIAL_HAND_SIZE,
    );

    const allEvents = [
      ...cleanupEvents,
      ...createResourceEvents(drawEvents, endTurnId),
    ];

    // Check game over
    const stateAfterDraw = applyEvents(state, allEvents);
    const gameOverEvent = checkGameOver(stateAfterDraw);
    if (gameOverEvent) {
      return {
        ok: true,
        events: [
          ...allEvents,
          {
            ...gameOverEvent,
            id: generateEventId(),
            causedBy: endTurnId,
          },
        ],
      };
    }

    // Start next turn - new root event (not caused by previous turn for log clarity)
    const nextPlayer = getNextPlayer(stateAfterDraw, player);
    const turnStartId = generateEventId();
    return {
      ok: true,
      events: [
        ...allEvents,
        {
          type: "TURN_STARTED",
          turn: state.turn + 1,
          player: nextPlayer,
          id: turnStartId,
        },
        ...createResourceEvents(
          [
            { type: "ACTIONS_MODIFIED", delta: 1 },
            { type: "BUYS_MODIFIED", delta: 1 },
          ],
          turnStartId,
        ),
      ],
    };
  }

  return { ok: true, events: [] };
}

export function handleRequestUndo(
  _state: GameState,
  player: PlayerId,
  toEventId: string,
  reason?: string,
): CommandResult {
  const requestId = `undo_${Date.now()}_${Math.random().toString(GAME_CONSTANTS.UUID_BASE).slice(GAME_CONSTANTS.UUID_SLICE)}`;

  const builder = new EventBuilder();
  builder.add({
    type: "UNDO_REQUESTED",
    requestId,
    byPlayer: player,
    toEventId,
    reason,
  });

  return { ok: true, events: builder.build() };
}
