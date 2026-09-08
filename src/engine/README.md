# Extending the engine

Commands validate player intent. Card effects describe events and either a real
player choice or child operations. `execute.ts` runs a stack until it finishes or
needs an answer. Only the runner assigns effect event IDs, applies intermediate
events, and persists the remaining stack through `EXECUTION_UPDATED`.

The stack is data: effect identity, owner, cause, local choice state, and pending
plays/reactions. It contains no functions or generators. A repeated play moves
one physical card and runs its effect twice; a nested choice finishes before the
next execution. Keep card-local stages inside card modules, never in command
handlers. A step must return a choice or child operations, not both.

## Adding cards

- Add metadata to `data/cards.ts`, the name to `types/basic-types.ts`, and the
  effect to `cards/base/index.ts`. The command handlers need no card-specific
  branches. Kingdom setup derives its list from definitions (`supply: "base"` excludes
  base piles). Variable victory cards provide their own `score(cards)` function.
- Use `createSimpleCardEffect` for resources/draws and card-local stage handlers
  for choices. Return `operations: [{ type: "play", card, playerId, from,
times }]` for nested or repeated plays.
- Use `createAttackEffect(benefit, attack)` to separate the attacker's benefit
  from the opponent effect. Both can suspend; reaction state and remaining work
  survive reload. Only resolved, unblocked targets reach the attack callback.
- Pass `ctx.random` to draw/shuffle helpers. Commands own the seeded stream and
  persist its cursor. Replaying recorded events never generates randomness.
- Use the `setAside` zone for cards temporarily removed from a deck. Record the
  actual shuffle and movement before asking about revealed cards. Preserve
  duplicate card counts when moving selections.
- Use `getCardCost` for purchases, gain limits, and upgrade comparisons.
- Submit `choiceId` when a client can retain the pending event ID. It rejects
  stale answers; it remains optional for existing clients. Choice counts,
  multiplicities, action IDs, ordering, and ownership are checked centrally.

## Expansion boundaries

The runner intentionally implements only mechanics used by the current set.
Additional mechanics should extend its typed operations/frames, with a test
that suspends, serializes, resumes, and rewinds through the interaction.

- Gain/trash/discard reactions need explicit timing windows around movement,
  plus replacement/cancellation semantics. Do not trigger new rules from the
  replay reducer: replay must only apply facts already recorded.
- Duration cards need scheduled frames in persisted state and explicit cleanup
  retention. Individual card IDs will be needed when effects track a particular
  physical copy across turns; current zones identify cards by name.
- More reaction types need registered reaction behavior. Current attack
  reactions implement Moat's blocking behavior; a future reaction must not be
  assumed to block just because it is a reaction.
- Alternate costs, split piles, tokens, and scoring rules need dedicated rule
  queries/state types. The current cost query models coin reductions only.
- Version persisted frame shapes when their meaning changes. The compatibility
  adapter handles old single-card choices and Throne Room continuations; it is
  not a general migration framework for arbitrary historical card scripts.

`all-cards-execution.test.ts` exercises every current action normally, repeated,
and via Vassal, checking conservation and reload at every choice. Focused card
tests verify individual rules. `persistence.test.ts` covers RNG, incremental
projection, forks, rewind, and undo negotiation. The public display log remains
a separate projection of events; session approval bookkeeping lives in
`undo-session.ts`.
