import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../happy-dom.test-fixture";
import { HUMAN_SEAT } from "../core/seats";
import { createLocalDominionSession } from "../context/create-local-dominion-session";
import { gameState$, seats$ } from "../context/game-signals";
import { SessionProvider, useDominionSession } from "./SessionContext";

beforeAll(registerHappyDom);

const humansOnly = (players: string[]) =>
  createLocalDominionSession(
    {
      kind: "new",
      players,
      seats: Object.fromEntries(players.map(id => [id, HUMAN_SEAT])),
    },
    { animation: null, stepDelayMs: 0 },
  );

/** Reports which session the tree sees, so the binding and the context can be compared */
function Probe({ seen }: { seen: string[] }) {
  seen.push(useDominionSession().id);
  return null;
}

// One sequential test: the provider writes the one module-level binding
describe("SessionProvider", () => {
  it("binds its session for the first paint and disposes it on unmount, so the next screen starts clean", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const seen: string[] = [];

    const first = humansOnly(["alice", "bob"]);
    const disposed: string[] = [];
    const watched = {
      ...first,
      dispose: () => {
        disposed.push(first.id);
        first.dispose();
      },
    };
    settled(() =>
      render(
        <SessionProvider session={watched}>
          <Probe seen={seen} />
        </SessionProvider>,
        root,
      ),
    );
    expect(seen).toEqual([first.id]);
    expect(gameState$.value?.playerOrder).toEqual(["alice", "bob"]);
    expect(seats$.value).toBe(first.seats.value);

    settled(() => render(null, root));
    expect(disposed).toEqual([first.id]);
    expect(gameState$.value).toBeNull();
    expect(seats$.value).toEqual({});

    // A later screen binds its own session; the disposed one's state never shows
    const second = humansOnly(["human", "ai"]);
    settled(() =>
      render(
        <SessionProvider session={second}>
          <Probe seen={seen} />
        </SessionProvider>,
        root,
      ),
    );
    expect(seen.at(-1)).toBe(second.id);
    expect(gameState$.value).toBe(second.state.value);
    expect(gameState$.value?.playerOrder).toEqual(["human", "ai"]);

    settled(() => render(null, root));
    root.remove();
    expect(gameState$.value).toBeNull();
  });
});
