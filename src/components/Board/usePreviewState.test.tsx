import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../../happy-dom.test-fixture";
import { render } from "preact";
import type { GameState } from "../../types/game-state";
import { createEmptyState } from "../../events/project";
import { usePreviewState } from "./usePreviewState";

beforeAll(registerHappyDom);

const POLL_MS = 5;
const TIMEOUT_MS = 1000;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

const TURN_BY_EVENT: Record<string, number> = { "evt-1": 1, "evt-2": 2 };

const stateNamed = (name: string): GameState => ({
  ...createEmptyState(),
  turn: TURN_BY_EVENT[name] ?? 0,
});

function mountProbe(
  getStateAtEvent: (eventId: string) => GameState | Promise<GameState>,
) {
  const root = document.createElement("div");
  const seen: Array<ReturnType<typeof usePreviewState>> = [];

  function Probe({ previewEventId }: { previewEventId: string | null }) {
    const result = usePreviewState(previewEventId, getStateAtEvent);
    seen.push(result);
    return <span>{result.state ? "preview" : "live"}</span>;
  }

  const show = (previewEventId: string | null) =>
    render(<Probe previewEventId={previewEventId} />, root);

  const latest = () => seen[seen.length - 1];

  return { show, latest, root };
}

function deferredLookups() {
  const pending = new Map<string, (state: GameState) => void>();
  const lookup = (id: string) =>
    new Promise<GameState>(resolve => pending.set(id, resolve));
  const requested = (id: string) => () => pending.has(id);
  const resolve = (id: string) => pending.get(id)?.(stateNamed(id));
  return { lookup, requested, resolve };
}

describe("usePreviewState", () => {
  it("resolves a synchronous lookup", async () => {
    const { show, root } = mountProbe(id => stateNamed(id));

    show("evt-1");

    await waitFor("preview text", () => root.textContent === "preview");
  });

  it("keeps the last resolved state while the next event loads", async () => {
    const lookups = deferredLookups();
    const { show, latest } = mountProbe(lookups.lookup);

    show("evt-1");
    await waitFor("evt-1 request", lookups.requested("evt-1"));
    lookups.resolve("evt-1");
    await waitFor("evt-1 state", () => latest()?.state?.turn === 1);

    show("evt-2");
    await waitFor("evt-2 request", lookups.requested("evt-2"));

    expect(latest()?.state).toEqual(stateNamed("evt-1"));
    expect(latest()?.isLoading).toBe(true);

    lookups.resolve("evt-2");
    await waitFor("evt-2 state", () => latest()?.state?.turn === 2);

    expect(latest()?.isLoading).toBe(false);
  });

  it("ignores a stale resolution that arrives after a newer request", async () => {
    const lookups = deferredLookups();
    const { show, latest } = mountProbe(lookups.lookup);

    show("evt-1");
    await waitFor("evt-1 request", lookups.requested("evt-1"));
    show("evt-2");
    await waitFor("evt-2 request", lookups.requested("evt-2"));

    lookups.resolve("evt-2");
    await waitFor("evt-2 state", () => latest()?.state?.turn === 2);
    lookups.resolve("evt-1");
    await settle();

    expect(latest()?.state).toEqual(stateNamed("evt-2"));
  });

  it("reports the error and clears the state when lookup fails", async () => {
    const { show, latest } = mountProbe(() =>
      Promise.reject(new Error("gone")),
    );

    show("evt-1");

    await waitFor("error", () => latest()?.error === "gone");
    expect(latest()?.state).toBeNull();
    expect(latest()?.isLoading).toBe(false);
  });

  it("returns to live when the preview event is cleared", async () => {
    const { show, root } = mountProbe(id => stateNamed(id));

    show("evt-1");
    await waitFor("preview text", () => root.textContent === "preview");

    show(null);
    await waitFor("live text", () => root.textContent === "live");
  });
});
