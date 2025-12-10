# Missing Event Concepts - Card-by-Card Analysis

After implementing EFFECT_REGISTERED, COST_MODIFIED, and attack/reaction events, analyzing remaining cards for simplification opportunities.

---

## Pattern 1: CARDS_PEEKED (Missing!) 🚨

### Cards Using Metadata to Pass Peeked Cards

**Library** (line 76):
```typescript
metadata: { cardsNeeded, peekedCards: peeked }
// Later reads: state.pendingDecision?.metadata.peekedCards
```

**Sentry** (line 107):
```typescript
metadata: { revealedCards: revealed }
// Later: (metadata?.revealedCards as CardName[]) || []
```

**Vassal** (line 48):
```typescript
metadata: { discardedCard: topCard }
```

**Bandit** (line 168):
```typescript
const revealed = (metadata?.revealed as CardName[]) || [];
```

### The Smell
1. Peeked/revealed cards are **invisible in event log** (replays don't show them!)
2. Metadata is untyped `Record<string, unknown>` (requires casting)
3. No distinction between "peek" (private) vs "reveal" (public)
4. Decision processing must read from `pendingDecision.metadata` instead of game state

### Proposed Event
```typescript
export type CardsPeekedEvent = EventMetadata & {
  type: "CARDS_PEEKED";
  player: PlayerId;
  cards: CardName[];
  from: "deck" | "discard";
  visibleTo: PlayerId[];  // [player] for private peek, [...all] for public reveal
};
```

### Add to PlayerState
```typescript
export type PlayerState = {
  // ... existing fields
  peekedCards: CardName[];      // Cards currently being looked at
  peekedFrom: "deck" | "discard" | null;
};
```

### Benefits
1. ✅ Event log shows what was peeked (replay visibility)
2. ✅ Type-safe state instead of untyped metadata
3. ✅ AI can analyze "player saw X cards" in strategic reasoning
4. ✅ Distinguish peek (Sentry sees top 2) from reveal (Bandit reveals to all)
5. ✅ Simplifies 3 base game cards + many expansion cards (Spy, Cartographer, Oracle, Lookout)

### Impact
**Base game:** Library, Sentry, Vassal (Harbinger views discard which is already visible state)
**Expansions:** Spy, Cartographer, Oracle, Lookout, Navigator, Golem, Scrying Pool, ~15 more cards

### Implementation Complexity
**Medium** - Requires:
1. New event type
2. New state fields
3. Event handler to set/clear peekedCards
4. Update 3 card implementations
5. Clear peekedCards when processed

---

## Pattern 2: Attack Cards Not Using Attack Events 🚨

### Militia (117 lines)
Currently does NOT emit ATTACK_DECLARED/RESOLVED.

**Problem:** Moat should block Militia, but doesn't!

**Fix:** Use same pattern as Witch:
1. Emit ATTACK_DECLARED
2. Check for reactions (Moat)
3. Emit ATTACK_RESOLVED per opponent
4. Apply discard only if not blocked

### Bureaucrat (125 lines)
Currently does NOT emit attack events.

**Problem:** Moat should block Bureaucrat (putting Victory on deck), but doesn't!

**Fix:** Add attack flow

### Bandit (224 lines - most complex!)
Uses metadata but has **CORRECTNESS BUG**:
```typescript
// Line 48: AI chooses for victim!
const toTrash = trashable.includes("Gold") ? "Gold" : trashable[0];
```

**Rules:** "Each other player... trashes a revealed Treasure **other than Copper** of their choice"

**Fix Required:**
1. Add attack flow (can be blocked by Moat)
2. Emit DECISION_REQUIRED for opponent when multiple trashable treasures
3. Opponent chooses which to trash

---

## Pattern 3: Exchange Events (Trash → Gain)

### Mine, Remodel Pattern
Both cards:
1. Trash a card
2. Gain a card based on trashed card cost

Current: `CARD_TRASHED` (causedBy: rootId) → `CARD_GAINED` (causedBy: rootId)

### Proposed Event?
```typescript
export type CardExchangedEvent = EventMetadata & {
  type: "CARD_EXCHANGED";
  player: PlayerId;
  trashedCard: CardName;
  gainedCard: CardName;
  gainTo: "hand" | "discard" | "deck";
};
```

### Analysis
**Verdict: NOT WORTH IT**
- causedBy already links trash → gain
- Only saves 1 event per exchange
- Doesn't simplify card logic (still 2 stages)
- Breaks atomicity (can't trash without gaining)

---

## Pattern 4: Throne Room Metadata Hack

```typescript
// throne-room.ts stores target in metadata:
metadata: {
  throneRoomTarget: cardToPlay,
  throneRoomExecutionsRemaining: 2
}
```

### Is There a Better Event?
```typescript
export type CardExecutionScheduledEvent = EventMetadata & {
  type: "CARD_EXECUTION_SCHEDULED";
  player: PlayerId;
  card: CardName;  // Card to execute
  executionsRemaining: number;  // 2 for Throne Room, 3 for King's Court
  multiplier: CardName;  // "Throne Room"
};
```

### Analysis
**Verdict: NOT WORTH IT**
- Throne Room only appears in 1 base game card
- Current metadata approach works fine
- Event would be complex to process
- King's Court (expansion) uses same pattern

**Keep metadata for truly card-specific state**

---

## Summary: What's Actually Worth Adding

### HIGH PRIORITY ⭐️⭐️⭐️
**1. CARDS_PEEKED Event**
- **Impact:** 3 base game cards, ~15 expansion cards
- **Simplifies:** Library, Sentry, Vassal implementations
- **Fixes:** Invisible state in replays
- **Estimate:** Medium complexity, high value

**2. Fix Militia Attack Flow**
- **Impact:** Moat should block Militia
- **Correctness:** Rules violation currently
- **Estimate:** Easy (copy Witch pattern)

**3. Fix Bureaucrat Attack Flow**
- **Impact:** Moat should block Bureaucrat
- **Correctness:** Rules violation currently
- **Estimate:** Easy (copy Witch pattern)

**4. Fix Bandit Victim Choice**
- **Impact:** Opponent should choose which treasure to trash
- **Correctness:** CRITICAL BUG - AI choosing for opponent!
- **Estimate:** Medium (multi-opponent decision flow)

### LOW PRIORITY
**5. CARD_EXCHANGED Event**
- **Verdict:** Skip - causedBy already handles this
- **Reason:** Doesn't actually simplify card logic

**6. Discard Reason Enum**
- **Verdict:** Skip - causedBy already tracks this
- **Reason:** Can infer from causal chain

---

## Recommendation

Implement in this order:
1. ✅ Fix Militia attack flow (30 min) - copy Witch pattern
2. ✅ Fix Bureaucrat attack flow (30 min) - copy Witch pattern
3. ✅ Fix Bandit victim choice (1 hour) - add opponent decisions
4. ⭐️ Add CARDS_PEEKED event (2 hours) - significant refactor, high value for expansions

After these, the event system will be **95% complete** for all expansions.
