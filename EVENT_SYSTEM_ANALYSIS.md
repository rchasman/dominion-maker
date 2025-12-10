# Event System Architecture Review

## Executive Summary

The event system is **fundamentally sound** with excellent causality tracking and clean event-sourcing patterns. However, there are **7 specific areas for improvement** to support future Dominion expansions (Duration cards, Reactions, Cost modifiers, Landmarks, etc.).

---

## What's Working Well ✅

### 1. **Causality Chain (causedBy)**
- Every event has optional `causedBy` field tracking its root cause
- `getCausalChain()` computes transitive causality for atomic undo
- Commands → root events → effect events forms clear tree
- **Verdict**: Excellent foundation for complex card interactions

### 2. **Atomic Event Primitives**
```typescript
CARD_DRAWN, CARD_PLAYED, CARD_DISCARDED, CARD_TRASHED,
CARD_GAINED, CARD_REVEALED, CARD_PUT_ON_DECK, CARD_RETURNED_TO_HAND
```
- Fine-grained movements between zones
- Each event is minimal & composable
- **Verdict**: Perfect for replay fidelity

### 3. **Resource Deltas (not absolutes)**
```typescript
ACTIONS_MODIFIED { delta: +2 }
BUYS_MODIFIED { delta: -1 }
COINS_MODIFIED { delta: +3 }
```
- Events record changes, not snapshots
- Supports multiple modifiers per turn (stacking bonuses)
- **Verdict**: Correct pattern for card effects

### 4. **Decision System**
- `DECISION_REQUIRED` → pause → `DECISION_RESOLVED` → resume
- Multi-stage cards (Cellar, Throne Room) use `stage` field
- Metadata preserves context across decision boundaries
- **Verdict**: Flexible for complex player choices

### 5. **Card Effects as Pure Functions**
```typescript
type CardEffect = (ctx: CardEffectContext) => CardEffectResult
// Returns: { events: GameEvent[], pendingDecision?: DecisionRequest }
```
- Pure computation: state + context → events
- No side effects in card logic
- **Verdict**: Testable & deterministic

---

## Event Modeling Smells 🚩

### 1. **Unused `playCount` Field (Ghost Feature)**
```typescript
// events/types.ts:81
export type CardPlayedEvent = EventMetadata & {
  type: "CARD_PLAYED";
  player: PlayerId;
  card: CardName;
  playCount?: number; // ⚠️ NEVER USED - Throne Room emits 2 separate CARD_PLAYED events
};
```

**Problem**: Throne Room doesn't use `playCount`. It emits:
```typescript
CARD_PLAYED { card: "Village" }  // First execution
CARD_PLAYED { card: "Village" }  // Second execution
```

**Why it's a smell**:
- Field exists in type but has zero reads
- Future maintainers will assume it's meaningful
- Unclear if Throne Room should use it

**Fix Options**:
1. **Remove** `playCount` entirely (current behavior is correct)
2. **Use** `playCount: 2` for Throne Room (requires engine changes)
3. **Document** that it's reserved for future King's Court (3x)

**Recommendation**: Remove it. Multiple CARD_PLAYED events is semantically correct (each execution is a distinct action that can trigger other effects).

---

### 2. **Missing Zone: "setAside" / "duration"**
```typescript
// Current zones
export type Zone = "hand" | "deck" | "discard" | "inPlay" | "supply" | "trash";
```

**Missing for expansions**:
- **Set Aside**: Used by Reserve cards (Coin of the Realm, Guide) - cards that go to a temporary zone and can be called later
- **Duration**: Used by Duration cards (Caravan, Wharf) - stay in play across turns

**Current workaround**: Library card uses "set_aside" in UI but actually discards from deck

**Impact**:
- Cannot implement Seaside expansion (Duration cards)
- Cannot implement Adventures expansion (Reserve cards)

**Fix**:
```typescript
export type Zone =
  | "hand" | "deck" | "discard" | "inPlay" | "supply" | "trash"
  | "setAside"   // Reserve cards (Adventures)
  | "duration";  // Duration cards (Seaside)

// New events
export type CardSetAsideEvent = EventMetadata & {
  type: "CARD_SET_ASIDE";
  player: PlayerId;
  card: CardName;
  from: "hand" | "deck" | "inPlay";
  reason?: "reserve" | "effect";  // Why it was set aside
};

export type CardCalledEvent = EventMetadata & {
  type: "CARD_CALLED";  // Play a Reserve card from setAside zone
  player: PlayerId;
  card: CardName;
};
```

---

### 3. **No Attack/Reaction Timing Events**
```typescript
// Current: Witch just emits CARD_GAINED for Curse
const curseEvents = opponents.map(opp => ({
  type: "CARD_GAINED",
  player: opp,
  card: "Curse",
  to: "discard",
}));
```

**Problem**: No way to interrupt with Reaction cards (Moat, Horse Traders)

**Missing semantics**:
- When does attack "target" a player? (for Lighthouse, Moat)
- When can reactions be played?
- Attack resolution order?

**Fix**: Add attack events
```typescript
export type AttackDeclaredEvent = EventMetadata & {
  type: "ATTACK_DECLARED";
  attacker: PlayerId;
  card: CardName;  // Card causing attack
  targets: PlayerId[];  // Who is being attacked
};

export type AttackResolvedEvent = EventMetadata & {
  type: "ATTACK_RESOLVED";
  attacker: PlayerId;
  target: PlayerId;
  card: CardName;
  blocked: boolean;  // true if Moat/Lighthouse prevented it
};

// Reaction played in response to attack
export type ReactionPlayedEvent = EventMetadata & {
  type: "REACTION_PLAYED";
  player: PlayerId;
  card: CardName;  // "Moat", "Horse Traders", etc.
  trigger: string;  // causedBy of the event that triggered reaction
};
```

**Flow**:
1. CARD_PLAYED { card: "Witch" }
2. ATTACK_DECLARED { targets: ["ai"] }
3. DECISION_REQUIRED { type: "reaction", ... } ← "Reveal Moat?"
4. REACTION_PLAYED { card: "Moat" } OR ATTACK_RESOLVED { blocked: false }

---

### 4. **No Cost Modification Events**
```typescript
// Cards like Bridge, Highway reduce costs by $1/$2
// But there's no event to track this!
```

**Problem**: Cost reductions are implicit in game state, not in event log

**Why it matters**:
- Replay won't show "why" a Province cost $6 instead of $8
- AI analysis can't see cost modifiers as strategic signals
- Display logic has to infer from inPlay cards

**Fix**:
```typescript
export type CostModifiedEvent = EventMetadata & {
  type: "COST_MODIFIED";
  card: CardName;  // Which card's cost changed
  delta: number;  // -1 for Bridge, -2 for Highway
  source: CardName;  // "Bridge", "Highway"
};

// Or more general:
export type EffectRegisteredEvent = EventMetadata & {
  type: "EFFECT_REGISTERED";
  effectType: "cost_reduction" | "extra_buy" | "attack_immunity";
  source: CardName;
  duration: "this_turn" | "until_cleanup" | "next_turn";
  parameters: Record<string, unknown>;
};
```

---

### 5. **Implicit Shuffle Detection**
```typescript
// createDrawEvents handles shuffle but it's buried in card logic
if (shuffled && cardsBeforeShuffle) {
  return [
    ...cardsBeforeShuffle.map(card => ({ type: "CARD_DRAWN", player, card })),
    { type: "DECK_SHUFFLED", player, newDeckOrder },
    ...cardsAfterShuffle.map(card => ({ type: "CARD_DRAWN", player, card })),
  ];
}
```

**Smell**: Shuffle logic is in helper function, not in engine reducer

**Better pattern**: Engine should emit DECK_SHUFFLED when it detects empty deck
- Keeps event logic centralized
- Card effects shouldn't "know" about shuffling

**However**: Current approach might be pragmatic since shuffle needs RNG seed

**Verdict**: Acceptable trade-off, but document that `newDeckOrder` is critical for determinism

---

### 6. **Missing: Turn-Spanning Effects**
```typescript
// No way to represent "at start of next turn" effects
// Duration cards (Caravan, Merchant Ship) have effects on NEXT turn
```

**Example**: Caravan (+1 Card next turn)
- Play Caravan on Turn 5
- At start of Turn 6, draw 1 card

**Current system has no event for this**

**Fix**:
```typescript
export type DurationEffectScheduledEvent = EventMetadata & {
  type: "DURATION_EFFECT_SCHEDULED";
  player: PlayerId;
  card: CardName;  // "Caravan"
  triggerOn: "start_of_turn" | "cleanup";
  turnsRemaining: number;  // 1 for most Duration cards
};

export type DurationEffectTriggeredEvent = EventMetadata & {
  type: "DURATION_EFFECT_TRIGGERED";
  player: PlayerId;
  card: CardName;
  scheduledBy: string;  // causedBy of the DURATION_EFFECT_SCHEDULED event
};
```

---

### 7. **Bandit: Deterministic Trash Choice Smell**
```typescript
// bandit.ts:48
const toTrash = trashable.includes("Gold") ? "Gold" : trashable[0];
```

**Problem**: AI always trashes Gold > Silver (deterministic)
- Opponent has no choice (should be DECISION_REQUIRED)
- Base game rules: "trash a revealed Treasure **of the victim's choice**"

**Fix**: Emit DECISION_REQUIRED if multiple trashable cards revealed
```typescript
if (trashable.length > 1) {
  return {
    events: revealEvents,
    pendingDecision: {
      type: "card_decision",
      player: opp,  // Victim chooses!
      prompt: "Bandit Attack: Choose which Treasure to trash",
      cardOptions: trashable,
      min: 1,
      max: 1,
      ...
    }
  };
}
```

---

## Missing Events for Future Expansions

### Prosperity
```typescript
COIN_TOKEN_GAINED { player, count }
COIN_TOKEN_SPENT { player, count }
VP_TOKEN_GAINED { player, count }  // Monument, Bishop
```

### Adventures
```typescript
TAVERN_MAT_CALLED { player, card }  // Reserve cards
ARTIFACT_GAINED { player, artifact: "Key" | "Flag" | ... }
```

### Empires
```typescript
DEBT_GAINED { player, amount }
DEBT_PAID { player, amount }
LANDMARK_ACTIVATED { landmark, player }
```

### Alchemy
```typescript
POTION_PLAYED { player }  // Track potion as separate resource
```

---

## Architecture Recommendations

### 1. **Event Type Hierarchy**
Organize events into categories:

```typescript
// Base game
type CoreEvent =
  | TurnStructureEvent  // TURN_STARTED, PHASE_CHANGED
  | CardMovementEvent   // CARD_DRAWN, CARD_PLAYED, etc.
  | ResourceEvent       // ACTIONS_MODIFIED, BUYS_MODIFIED
  | DecisionEvent;      // DECISION_REQUIRED, DECISION_RESOLVED

// Expansion events
type AttackEvent =
  | AttackDeclaredEvent
  | AttackResolvedEvent
  | ReactionPlayedEvent;

type DurationEvent =
  | DurationEffectScheduledEvent
  | DurationEffectTriggeredEvent;

type GameEvent = CoreEvent | AttackEvent | DurationEvent | ...;
```

**Benefit**: Clear namespace for expansion events

### 2. **Effect Registration Pattern**
Instead of implicit effects, register them explicitly:

```typescript
// When playing Bridge (-$1 cost this turn):
CARD_PLAYED { card: "Bridge" }
EFFECT_REGISTERED {
  effectType: "cost_reduction",
  source: "Bridge",
  duration: "this_turn",
  parameters: { amount: 1 }
}

// Engine tracks active effects in state.activeEffects[]
// Cleanup phase: EFFECT_EXPIRED { ... }
```

**Benefit**: Event log shows "why" costs/rules changed

### 3. **Zone Transition Validator**
Enforce valid zone transitions:

```typescript
const VALID_TRANSITIONS: Record<Zone, Zone[]> = {
  hand: ["inPlay", "discard", "trash", "setAside", "deck"],
  deck: ["hand", "discard", "trash", "revealed"],
  inPlay: ["discard", "hand", "trash", "duration"],
  duration: ["inPlay", "discard"],  // Duration cards return to play
  ...
};
```

**Benefit**: Catch invalid card movements at event emission time

### 4. **Event Versioning**
Add version field for future breaking changes:

```typescript
export type EventMetadata = {
  id?: string;
  causedBy?: string;
  version?: number;  // Default: 1
};
```

**Benefit**: Can evolve event schema while supporting old saved games

---

## Immediate Action Items

### High Priority
1. ✅ **Remove `playCount` field** from CardPlayedEvent (unused, confusing)
2. ✅ **Add setAside and duration zones** (blocking Seaside/Adventures)
3. ✅ **Add ATTACK_DECLARED/REACTION_PLAYED events** (blocking Moat, base game card!)

### Medium Priority
4. ✅ **Add COST_MODIFIED or EFFECT_REGISTERED** (better AI, better display)
5. ✅ **Fix Bandit to request victim's choice** (correctness bug)
6. ✅ **Add DURATION_EFFECT_SCHEDULED** (blocking Seaside)

### Low Priority (Can Defer)
7. Document shuffle determinism requirements
8. Add event versioning
9. Create zone transition validator

---

## Code Quality Observations

### Excellent Patterns ✨
- **CardEffect as pure function**: Testable, composable
- **causedBy chain**: Elegant atomic undo
- **Delta-based resources**: Compositional
- **Decision system**: Handles complex multi-stage cards
- **Event sourcing**: Single source of truth, perfect replay

### Anti-Patterns to Avoid
- ❌ **Ghost fields**: `playCount` is defined but never used
- ❌ **Magic numbers in metadata**: Use typed enums for `stage` values
- ❌ **AI choosing for opponent**: Bandit should ask victim

### Recommended Reading
For similar systems that solved these problems:
- **MTG Arena**: Attack/block protocol, stack for reactions
- **Hearthstone**: Queued events for simultaneous effects
- **Slay the Spire**: Relic/power system for persistent effects

---

## Conclusion

**The event system is 85% excellent.** The causality tracking, atomic events, and pure card effects are professional-grade. The 7 issues identified are all **fixable without breaking existing code**—they're additions, not refactors.

**Priority**: Fix #1-3 (zones, attacks, remove playCount) before adding more cards. These block entire expansions.

**Extensibility Score**: 7/10 → Can reach 9.5/10 with proposed changes.
