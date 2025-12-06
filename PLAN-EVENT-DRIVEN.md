# Stateless Event-Driven Dominion Architecture

## Core Insight

Convert from **state mutation** to **event sourcing**:
- Current: `CardEffect = (state) => newState`
- Target: `CardEffect = (state) => Event[]`

State becomes a **projection** of events, not a mutable object.

---

## Architecture Overview

```
Command → Validate(state) → Events → Apply(state, events) → newState
            ↑                                    ↓
            └────────── projectState(events) ───┘
```

**Three layers:**
1. **Events** - Immutable facts (past tense: "CARDS_DRAWN")
2. **Commands** - User intent (imperative: "PLAY_CARD")
3. **State** - Derived by replaying events

---

## Event Types

### Primitive Events (atomic, irreducible)

```typescript
// Card Movement
| { type: "CARDS_DRAWN"; player: Player; cards: CardName[] }
| { type: "CARD_PLAYED"; player: Player; card: CardName }
| { type: "CARDS_DISCARDED"; player: Player; cards: CardName[]; from: Zone }
| { type: "CARDS_TRASHED"; player: Player; cards: CardName[] }
| { type: "CARD_GAINED"; player: Player; card: CardName; to: Zone }
| { type: "CARDS_REVEALED"; player: Player; cards: CardName[] }
| { type: "DECK_SHUFFLED"; player: Player }

// Resources
| { type: "ACTIONS_MODIFIED"; delta: number }
| { type: "BUYS_MODIFIED"; delta: number }
| { type: "COINS_MODIFIED"; delta: number }

// Turn Structure
| { type: "TURN_STARTED"; turn: number; player: Player }
| { type: "PHASE_CHANGED"; phase: Phase }

// Decisions
| { type: "DECISION_REQUIRED"; decision: Decision }
| { type: "DECISION_RESOLVED"; choice: Choice }

// Game
| { type: "GAME_STARTED"; config: GameConfig }
| { type: "GAME_ENDED"; winner: Player | null; scores: Scores }
```

### Why These Events?

Each event represents **one atomic change** that can be:
- Validated independently
- Applied to state idempotently
- Replayed to reconstruct any game state
- Transmitted for multiplayer sync

---

## Card Effects as Event Emitters

### Before (state mutation):
```typescript
const smithy: CardEffect = ({ state, player, children }) => {
  const { player: afterDraw, drawn } = drawCards(state.players[player], 3);
  children.push({ type: "draw-cards", player, count: 3, cards: drawn });
  return {
    ...state,
    players: { ...state.players, [player]: afterDraw }
  };
};
```

### After (event emission):
```typescript
const smithy: CardEffect = ({ state, player }) => {
  const drawn = peekDraw(state.players[player], 3);
  return {
    events: [
      { type: "CARDS_DRAWN", player, cards: drawn.cards },
      ...(drawn.shuffled ? [{ type: "DECK_SHUFFLED", player }] : [])
    ]
  };
};
```

### Multi-Stage Cards (Cellar, Militia, etc.)

```typescript
const cellar: CardEffect = ({ state, player, decision }) => {
  // Stage 1: Request discard decision
  if (!decision) {
    return {
      events: [{ type: "ACTIONS_MODIFIED", delta: 1 }],
      pendingDecision: {
        type: "select_cards",
        from: "hand",
        min: 0,
        max: state.players[player].hand.length,
        prompt: "Discard any number of cards to draw that many"
      }
    };
  }

  // Stage 2: Execute discard + draw
  const discarded = decision.selectedCards;
  const drawn = peekDraw(state.players[player], discarded.length);

  return {
    events: [
      { type: "CARDS_DISCARDED", player, cards: discarded, from: "hand" },
      { type: "CARDS_DRAWN", player, cards: drawn.cards },
      ...(drawn.shuffled ? [{ type: "DECK_SHUFFLED", player }] : [])
    ]
  };
};
```

---

## State Projection

```typescript
function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "CARDS_DRAWN":
      return produce(state, draft => {
        const p = draft.players[event.player];
        // Remove from deck (bottom = top of deck)
        const fromDeck = p.deck.splice(-event.cards.length);
        // Add to hand
        p.hand.push(...event.cards);
      });

    case "CARDS_DISCARDED":
      return produce(state, draft => {
        const p = draft.players[event.player];
        for (const card of event.cards) {
          const zone = event.from === "hand" ? p.hand : p.inPlay;
          const idx = zone.indexOf(card);
          if (idx !== -1) zone.splice(idx, 1);
          p.discard.push(card);
        }
      });

    case "ACTIONS_MODIFIED":
      return { ...state, actions: state.actions + event.delta };

    // ... all other events
  }
}

function projectState(events: GameEvent[]): GameState {
  return events.reduce(applyEvent, createInitialState());
}
```

---

## Command Handling

```typescript
type CommandResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; error: string };

function handleCommand(state: GameState, cmd: GameCommand): CommandResult {
  switch (cmd.type) {
    case "PLAY_ACTION": {
      // Validate
      if (state.phase !== "action") return { ok: false, error: "Not action phase" };
      if (state.actions < 1) return { ok: false, error: "No actions remaining" };
      if (!state.players[state.activePlayer].hand.includes(cmd.card)) {
        return { ok: false, error: "Card not in hand" };
      }

      // Base events for playing a card
      const baseEvents: GameEvent[] = [
        { type: "CARD_PLAYED", player: state.activePlayer, card: cmd.card },
        { type: "ACTIONS_MODIFIED", delta: -1 }
      ];

      // Apply base events to get intermediate state
      const midState = baseEvents.reduce(applyEvent, state);

      // Execute card effect
      const effect = CARD_EFFECTS[cmd.card];
      const result = effect({ state: midState, player: state.activePlayer });

      return { ok: true, events: [...baseEvents, ...result.events] };
    }

    case "BUY_CARD": {
      const cost = CARDS[cmd.card].cost;
      if (state.phase !== "buy") return { ok: false, error: "Not buy phase" };
      if (state.buys < 1) return { ok: false, error: "No buys remaining" };
      if (state.coins < cost) return { ok: false, error: "Not enough coins" };
      if (state.supply[cmd.card] <= 0) return { ok: false, error: "Card not in supply" };

      return {
        ok: true,
        events: [
          { type: "CARD_GAINED", player: state.activePlayer, card: cmd.card, to: "discard" },
          { type: "BUYS_MODIFIED", delta: -1 },
          { type: "COINS_MODIFIED", delta: -cost }
        ]
      };
    }

    // ... other commands
  }
}
```

---

## Game Engine

```typescript
class DominionEngine {
  private events: GameEvent[] = [];
  private _state: GameState | null = null;

  get state(): GameState {
    if (!this._state) {
      this._state = projectState(this.events);
    }
    return this._state;
  }

  dispatch(command: GameCommand): CommandResult {
    const result = handleCommand(this.state, command);

    if (result.ok) {
      this.events.push(...result.events);
      this._state = null; // Invalidate cache

      // Check for game over
      this.checkGameOver();
    }

    return result;
  }

  // Replay to any point
  replayTo(eventIndex: number): GameState {
    return projectState(this.events.slice(0, eventIndex));
  }

  // Branch for hypotheticals (LLM voting)
  branch(): DominionEngine {
    const fork = new DominionEngine();
    fork.events = [...this.events];
    return fork;
  }

  // Serialize for persistence/multiplayer
  serialize(): string {
    return JSON.stringify(this.events);
  }

  static deserialize(json: string): DominionEngine {
    const engine = new DominionEngine();
    engine.events = JSON.parse(json);
    return engine;
  }
}
```

---

## File Structure

```
src/
├── events/
│   ├── types.ts          # GameEvent union type + Zod schemas
│   ├── apply.ts          # applyEvent(state, event)
│   └── project.ts        # projectState(events)
│
├── commands/
│   ├── types.ts          # GameCommand union type
│   ├── validate.ts       # Command validation helpers
│   └── handle.ts         # handleCommand(state, command)
│
├── cards/
│   ├── effect.ts         # CardEffect type (returns events)
│   └── base/             # Each card returns events
│       ├── smithy.ts
│       ├── cellar.ts
│       └── ...
│
├── engine/
│   ├── engine.ts         # DominionEngine class
│   ├── decisions.ts      # Decision handling logic
│   └── game-over.ts      # Win condition checks
│
└── types/
    └── game-state.ts     # GameState (derived type)
```

---

## Migration Strategy

### Phase 1: Event Foundation
1. Define all event types in `src/events/types.ts`
2. Implement `applyEvent` for each event type
3. Test: `projectState(sampleEvents)` produces valid state

### Phase 2: Card Effects
1. Update `CardEffect` type to return `{ events, pendingDecision? }`
2. Convert each card, simplest first:
   - Smithy, Village, Laboratory (no decisions)
   - Workshop, Remodel (single decision)
   - Cellar, Militia (multi-stage)
3. Test each card produces correct events

### Phase 3: Command Layer
1. Define command types
2. Implement `handleCommand` for each command
3. Wire up validation
4. Test: commands → events → valid state

### Phase 4: Engine Integration
1. Create `DominionEngine` class
2. Replace `GameContext` state management
3. Update UI to dispatch commands
4. Test full game flow

### Phase 5: Benefits Realization
1. Add replay functionality
2. Add branch/fork for LLM hypotheticals
3. Add event persistence
4. Multiplayer sync via events

---

## Benefits

1. **Perfect Replay** - Reconstruct any game state from events
2. **Debugging** - Events form complete audit trail
3. **Undo** - Replay events up to N-1
4. **Testing** - Test by feeding event sequences
5. **Multiplayer** - Sync via events, deterministic state
6. **LLM Voting** - Branch and test hypotheticals
7. **Persistence** - Just save event array
8. **Time Travel** - Jump to any point in game

---

## Multiplayer Architecture

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                               │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Event Store │◄───│ handleCommand│◄───│ Validate Turn │  │
│  │  (source    │    │  (cmd→events)│    │ (whose turn?) │  │
│  │   of truth) │    └──────────────┘    └───────────────┘  │
│  └──────┬──────┘                                ▲           │
│         │ broadcast                             │ command   │
└─────────┼───────────────────────────────────────┼───────────┘
          │                                       │
    ┌─────┴─────┬─────────────────┐              │
    ▼           ▼                 ▼              │
┌───────┐  ┌───────┐         ┌───────┐          │
│Client1│  │Client2│   ...   │ClientN│──────────┘
│ apply │  │ apply │         │ apply │
│events │  │events │         │events │
└───────┘  └───────┘         └───────┘
```

### Player IDs

Change from `"human" | "ai"` to string IDs:

```typescript
type PlayerId = string; // "player_abc123"

type GameEvent =
  | { type: "CARDS_DRAWN"; player: PlayerId; cards: CardName[] }
  | { type: "CARD_PLAYED"; player: PlayerId; card: CardName }
  // ...
```

### Hidden Information

Dominion has hidden info (hands, decks). Two approaches:

**Option A: Full events, client filters**
- Server broadcasts all events
- Clients filter what to display
- Simpler, but trusts clients (fine for casual play)

**Option B: Redacted events per client**
- Server sends different events to each client
- `CARDS_DRAWN` to opponent shows count, not cards
- More secure, complex

```typescript
// Server-side event transformation
function redactForPlayer(event: GameEvent, forPlayer: PlayerId): GameEvent {
  if (event.type === "CARDS_DRAWN" && event.player !== forPlayer) {
    return { ...event, cards: Array(event.cards.length).fill("HIDDEN") };
  }
  return event;
}
```

### Turn Validation

Server rejects commands from wrong player:

```typescript
function handleCommand(state: GameState, cmd: GameCommand, fromPlayer: PlayerId): CommandResult {
  // Validate it's this player's turn (or they're responding to attack)
  if (state.activePlayer !== fromPlayer && !isValidInterrupt(state, fromPlayer)) {
    return { ok: false, error: "Not your turn" };
  }
  // ... rest of handling
}
```

### Reconnection

Player disconnects, reconnects:
1. Server sends full event history (or snapshot + recent events)
2. Client rebuilds state via `projectState(events)`
3. Seamless resume

### Undo / Time Travel

Event sourcing makes undo trivial - just truncate the event log.

**Undo Request Flow:**

```
┌─────────┐  REQUEST_UNDO   ┌────────┐  UNDO_REQUESTED  ┌─────────┐
│ Player1 │ ──────────────► │ Server │ ───────────────► │ Player2 │
└─────────┘                 └────────┘                  └────┬────┘
                                 ▲                          │
                                 │ APPROVE_UNDO             │
                                 └──────────────────────────┘
                                 │
                                 ▼
                            truncate events
                            broadcast new state
```

**New Commands:**

```typescript
type GameCommand =
  // ... existing commands
  | { type: "REQUEST_UNDO"; toEventIndex: number; reason?: string }
  | { type: "APPROVE_UNDO"; requestId: string }
  | { type: "DENY_UNDO"; requestId: string }
```

**New Events:**

```typescript
type GameEvent =
  // ... existing events
  | { type: "UNDO_REQUESTED"; requestId: string; byPlayer: PlayerId; toEventIndex: number; reason?: string }
  | { type: "UNDO_APPROVED"; requestId: string; byPlayer: PlayerId }
  | { type: "UNDO_DENIED"; requestId: string; byPlayer: PlayerId }
  | { type: "UNDO_EXECUTED"; fromEventIndex: number; toEventIndex: number }
```

**Server State:**

```typescript
type GameRoom = {
  events: GameEvent[];           // The canonical event log
  pendingUndoRequest?: {
    requestId: string;
    byPlayer: PlayerId;
    toEventIndex: number;        // Rewind to this point
    approvals: Set<PlayerId>;    // Who has approved
    needed: number;              // How many approvals needed (all opponents)
  };
};
```

**Click-to-Rewind UI:**

Each log entry maps to an event index. Clicking shows:
1. Preview of state at that point (read-only)
2. "Request to rewind here" button
3. Opponent sees approval modal

```typescript
// Client-side preview (no server needed)
function previewStateAt(eventIndex: number): GameState {
  return projectState(eventLog.slice(0, eventIndex + 1));
}

// Request rewind
function requestUndo(toEventIndex: number) {
  socket.send({ type: "REQUEST_UNDO", toEventIndex });
}
```

**After Undo Approved:**

```typescript
// Server-side
function executeUndo(room: GameRoom, toEventIndex: number) {
  const removedEvents = room.events.splice(toEventIndex + 1);

  // Record the undo itself (for audit trail)
  room.events.push({
    type: "UNDO_EXECUTED",
    fromEventIndex: room.events.length + removedEvents.length,
    toEventIndex
  });

  // Broadcast to all clients
  broadcast(room, { type: "STATE_RESET", events: room.events });
}
```

**Branching History (Optional):**

Instead of destroying events, keep them as branches:

```typescript
type GameRoom = {
  events: GameEvent[];
  branches: {
    id: string;
    forkedAt: number;           // Event index where branch started
    events: GameEvent[];        // Events in this branch
    reason: string;             // "Undo by alice"
  }[];
};
```

This lets you:
- View alternate timelines
- "What if we hadn't undone?"
- Full game archaeology

**UI Considerations:**

```
┌─────────────────────────────────────┐
│ Game Log                        [▼] │
├─────────────────────────────────────┤
│ Turn 1 - Alice                      │
│   ├─ Played Village        [⏪]     │  ← Click to preview/request rewind
│   ├─ Played Smithy         [⏪]     │
│   └─ Bought Silver         [⏪]     │
│ Turn 2 - Bob                        │
│   ├─ Played Militia        [⏪]     │
│   │   └─ Alice discarded 2         │
│   └─ Bought Gold           [⏪] ◄── │  Current
└─────────────────────────────────────┘

[Preview mode: Turn 1, after Village]
┌─────────────────────────────────────┐
│ 👁️ Viewing past state               │
│ [Request Rewind Here] [Cancel]      │
└─────────────────────────────────────┘
```

### Optimistic Updates (Optional)

For responsiveness:
1. Client applies command locally (optimistic)
2. Sends command to server
3. Server validates, broadcasts events
4. Client reconciles (usually no-op, rollback if rejected)

```typescript
// Client-side
function dispatch(cmd: GameCommand) {
  // Optimistic local update
  const optimisticEvents = handleCommand(localState, cmd);
  if (optimisticEvents.ok) {
    localState = applyEvents(localState, optimisticEvents.events);
    pendingCommands.push({ cmd, optimisticEvents });
  }

  // Send to server
  socket.send(cmd);
}

// On server response
socket.on("events", (serverEvents) => {
  // Reconcile - server is source of truth
  eventLog.push(...serverEvents);
  localState = projectState(eventLog);
});
```

### N-Player Support

Events naturally support N players:

```typescript
type GameConfig = {
  players: PlayerId[];      // ["alice", "bob", "carol", "dave"]
  turnOrder: PlayerId[];    // Same, or randomized
  kingdomCards: CardName[];
};

// Turn rotation
function nextPlayer(state: GameState): PlayerId {
  const currentIdx = state.turnOrder.indexOf(state.activePlayer);
  return state.turnOrder[(currentIdx + 1) % state.turnOrder.length];
}
```

### Attack Cards in Multiplayer

Militia affects all opponents, not just one:

```typescript
const militia: CardEffect = ({ state, player }) => {
  const opponents = state.turnOrder.filter(p => p !== player);

  // Check who needs to discard
  const needsDiscard = opponents.filter(
    opp => state.players[opp].hand.length > 3
  );

  if (needsDiscard.length === 0) {
    return { events: [{ type: "COINS_MODIFIED", delta: 2 }] };
  }

  return {
    events: [{ type: "COINS_MODIFIED", delta: 2 }],
    pendingDecision: {
      type: "discard",
      player: needsDiscard[0], // First opponent
      prompt: "Discard down to 3 cards",
      // metadata tracks remaining opponents
      metadata: { remainingOpponents: needsDiscard.slice(1) }
    }
  };
};
```

---

## Key Design Decisions

### Why not use reducers directly?
Reducers couple action names to state changes. Events decouple **what happened** from **how state changes**, allowing:
- Multiple events per command
- Event-level validation
- Reordering/batching events

### Why pending decisions in card effects?
Multi-stage cards need to pause and request input. The `pendingDecision` in the return value signals the engine to:
1. Store pending decision in state
2. Wait for `SUBMIT_DECISION` command
3. Resume card effect with decision

### Why not just use the existing log?
The existing `LogEntry` is UI-focused (human-readable). Events are:
- Minimal (just data needed to reconstruct state)
- Typed (discriminated union)
- Reversible (can derive undo events)
