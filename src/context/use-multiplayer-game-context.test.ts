import { beforeAll, describe, expect, it, spyOn } from "bun:test";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";

beforeAll(registerHappyDom);

// One sequential test: the adapter writes module-level signals
describe("useMultiplayerGameContext", () => {
  it("parses the room's Dominion state and sends commands under this client's id", async () => {
    const { render, h } = await import("preact");
    const { createGame } = await import("../engine");
    const { dominionModule } = await import("../dominion/module");
    const { multiplayerLogger } = await import("../lib/logger");
    const { useMultiplayerGameContext } =
      await import("./use-multiplayer-game-context");
    type Room = import("./use-multiplayer-game-context").MultiplayerRoom;
    const {
      gameState$,
      events$,
      playAction$,
      requestUndo$,
      pendingUndo$,
      getStateAtEvent$,
    } = await import("./game-signals");

    const engine = createGame(["p1", "p2"], undefined, 42);
    /** Round-trips through JSON the way the room's wire does */
    const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    const viewed: unknown = wire(
      dominionModule.view(engine.state, engine.eventLog, "p1"),
    );
    const log: unknown[] = wire(dominionModule.publicEvents(engine.eventLog));

    const commands: unknown[] = [];
    const room: Room = {
      state: viewed,
      events: log,
      playerInfo: {
        p1: { id: "p1", name: "Alice", type: "human", connected: true },
        p2: { id: "p2", name: "Bob", type: "ai", connected: true },
      },
      playerId: "p1",
      isConnected: true,
      isJoined: true,
      spectatorCount: 0,
      isHost: true,
      players: [
        { name: "Alice", playerId: "p1", controller: "human" },
        { name: "Bob", playerId: "p2", controller: "llm" },
      ],
      chatMessages: [],
      sendCommand: (command: unknown) => commands.push(command),
      setSeat: () => undefined,
      getStateAtEvent: () => Promise.resolve(viewed),
      startGame: () => undefined,
      sendChat: () => undefined,
    };

    const Probe = (props: { room: Room }) => {
      useMultiplayerGameContext({
        game: props.room,
        playerName: "Alice",
        isSpectator: false,
      });
      return null;
    };

    const root = document.createElement("div");
    document.body.appendChild(root);

    settled(() => render(h(Probe, { room }), root));

    // The board sees a parsed state carrying the room's own player info
    const state = gameState$.value;
    expect(state).not.toBeNull();
    expect(state?.playerInfo?.p1?.name).toBe("Alice");
    expect(state?.supply).toEqual(engine.state.supply);
    expect(events$.value).toHaveLength(log.length);

    // A board action becomes one command the Dominion module accepts
    const firstCardInHand = state?.players.p1?.hand[0] ?? "Copper";
    playAction$.value?.(firstCardInHand);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({
      type: "PLAY_ACTION",
      playerId: "p1",
      card: firstCardInHand,
    });
    expect(dominionModule.commandSchema.safeParse(commands[0]).success).toBe(
      true,
    );

    requestUndo$.value?.("e1");
    expect(commands[1]).toEqual({
      type: "REQUEST_UNDO",
      playerId: "p1",
      toEventId: "e1",
    });

    // History preview comes back parsed, not opaque
    const preview = await getStateAtEvent$.value?.("e1");
    expect(preview?.supply).toEqual(engine.state.supply);

    // An open undo request on the log reaches the board as a pending undo
    const requested: unknown[] = wire([
      ...dominionModule.publicEvents(engine.eventLog),
      {
        id: "u1",
        type: "UNDO_REQUESTED" as const,
        requestId: "r1",
        byPlayer: "p2",
        toEventId: "e1",
      },
    ]);
    expect(pendingUndo$.value).toBeNull();
    settled(() =>
      render(h(Probe, { room: { ...room, events: requested } }), root),
    );
    expect(pendingUndo$.value?.requestId).toBe("r1");
    expect(pendingUndo$.value?.byPlayer).toBe("p2");

    // A state this client cannot read is refused out loud, never half-applied
    const logged = spyOn(multiplayerLogger, "error");
    settled(() =>
      render(h(Probe, { room: { ...room, state: { nonsense: true } } }), root),
    );
    expect(gameState$.value).toBeNull();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();

    render(null, root);
    root.remove();
  });
});
