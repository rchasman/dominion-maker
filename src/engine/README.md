# Extending the engine

Commands validate player intent. Each card exposes one `run(context, input)`
program and a schema for its saved local memory. A step returns one of:

- `done(events)` — finish this invocation.
- `choose(request, memory, events)` — ask a player, then resume with their answer.
- `schedule(operations, events, continuation?)` — finish child work in order,
  then optionally resume this invocation with the saved continuation.

`execute.ts` owns the stack, event IDs, intermediate state projection, reaction
windows, and checkpoints. Frames are serializable data. A nested choice finishes
before its caller resumes; repeating a play moves one physical card and invokes
its effect multiple times. Cards never read a pending UI choice to recover their
execution state.

## Adding a card

Add its name and metadata to `types/basic-types.ts` and `data/cards.ts`, then
register its program in `cards/base/index.ts`. Commands need no card branches.
Kingdom membership and variable victory scoring come from card definitions.

Use `createSimpleCardEffect` for resources and draws. For choices, use
`defineEffect(memorySchema, handler)`: `input.type` distinguishes a fresh play,
a player answer, and continuation after child work. Schemas validate memory
before it is saved or resumed. Use a strict object schema for structured memory.

A choice request contains only presentation and allowed responses: intent,
options, counts, actions, and ordering. Keep revealed cards and other local
bookkeeping in memory. The command boundary checks ownership, multiplicities,
actions, and ordering; include `choiceId` to reject stale responses.

Schedule `{ type: "play", card, playerId, from, times }` for nested or repeated
plays. `schedule(operations, events, memory)` also supports a caller that must
continue after its children. This is tested with a reaction that plays Workshop,
waits through its gain choice and reload, then resumes to block an attack.

Attack programs schedule `{ type: "attack", targets }` after producing their
attacker benefit. The runner invokes the same program with an `attack` trigger
for each unblocked target, completing that target before advancing. Reactions
use the same program contract with a `reaction` trigger. They can ask questions
and schedule children; only an explicit `blockAttack` result blocks. A
nonblocking reaction returns to the reaction window.

Pass `context.random` to shuffle/draw helpers. Commands persist the seeded
cursor; replay applies recorded facts without generating randomness. Use
`setAside` for revealed cards that must stay outside reshuffles, and preserve
multiplicities when moving cards. Use `getCardCost` for buying, gaining, and
upgrade comparisons.

## Persistence and extension boundaries

Version 2 checkpoints contain invocation identity, trigger, validated memory,
and pending child work. `resume.ts` validates that a checkpoint matches the
public choice before execution. `migrate-execution.ts` translates historical
stage/metadata checkpoints at that boundary; current cards and the runner do
not interpret those formats.

The current operation set covers the base cards and nested reaction programs.
New mechanics should extend explicit rules data where needed:

- Duration effects need persisted turn scheduling and cleanup retention.
- Tracking a particular physical copy across turns needs card instance IDs.
- Gain/trash replacement effects need movement timing and cancellation rules.
- Alternate currencies and split piles need richer cost and supply types.

These are distinct game rules, not behavior to infer inside the event reducer.
Implement each with a suspension/reload/rewind regression when introducing it.

`all-cards-execution.test.ts` exercises every current action normally, repeated,
and via Vassal, checking conservation and reload at each choice. Focused card
and migration tests cover rules and historical saves. `persistence.test.ts`
covers RNG, incremental projection, forks, rewind, and undo negotiation.
