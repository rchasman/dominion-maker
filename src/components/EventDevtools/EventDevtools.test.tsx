import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { EventDevtools } from "./EventDevtools";
import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";

beforeAll(registerHappyDom);

type FakeEvent = DevtoolsEvent & { type: "MOVE" | "NOTE" };

const EVENTS: FakeEvent[] = [
  { id: "a", type: "MOVE" },
  { id: "b", type: "NOTE" },
  { id: "c", type: "MOVE" },
];

const adapter: EventDevtoolsAdapter<FakeEvent> = {
  isRoot: event => event.type === "MOVE",
  label: event => `${event.id} says ${event.type}`,
  category: event => (event.type === "MOVE" ? "moves" : "notes"),
  categories: ["moves", "notes"],
  colour: event => (event.type === "MOVE" ? "#111111" : "#222222"),
  stateAt: index => ({ seen: index + 1, players: { a: { moves: index } } }),
};

const mount = (
  root: HTMLElement,
  onScrub: (eventId: string | null) => void,
) => {
  settled(() => {
    render(
      <EventDevtools events={EVENTS} adapter={adapter} onScrub={onScrub} />,
      root,
    );
  });
};

describe("the event devtools panel", () => {
  it("reads every event and the state through the adapter", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mount(root, () => {});

    const rows = [...root.querySelectorAll("[data-event-index]")];
    expect(rows.length).toBe(EVENTS.length);
    expect(rows[0]?.textContent).toContain("a says MOVE");
    expect(root.textContent).toContain('"seen": 3');

    // One scrubber stop per root event, and "all" plus the adapter's chips
    const slider = root.querySelector("#timeline-scrubber");
    expect(slider?.getAttribute("max")).toBe("1");
    const chips = [...root.querySelectorAll("button")].map(b => b.textContent);
    expect(chips).toContain("all");
    expect(chips).toContain("moves");
    expect(chips).toContain("notes");

    render(null, root);
    root.remove();
  });

  it("names the field that changed, one level in", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mount(root, () => {});

    const diff = [...root.querySelectorAll("button")].find(
      button => button.textContent === "Diff",
    );
    settled(() => {
      diff?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const rows = [...root.querySelectorAll("div")]
      .map(row => row.textContent)
      .filter(text => text?.startsWith("players.a"));
    expect(rows.length).toBeGreaterThan(0);
    expect(root.textContent).toContain("seen");

    render(null, root);
    root.remove();
  });

  it("filters to one category and scrubs by event id", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const scrubbed: (string | null)[] = [];
    mount(root, id => scrubbed.push(id));

    const chip = [...root.querySelectorAll("button")].find(
      button => button.textContent === "notes",
    );
    settled(() => {
      chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const filtered = [...root.querySelectorAll("[data-event-index]")];
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.textContent).toContain("b says NOTE");

    settled(() => {
      filtered[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(scrubbed).toEqual(["b"]);

    render(null, root);
    root.remove();
  });
});
