import { beforeAll, describe, expect, it } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import { GameSidebar } from "./GameSidebar";
import { HUMAN_SEAT } from "../../core/seats";
import type { SeatPreset } from "../../context/seat-presets";

beforeAll(registerHappyDom);

/** Deliberately not Dominion's own names, so a hard-coded table would show */
const LABELS: Record<SeatPreset, string> = {
  rules: "Solo",
  hybrid: "Duel",
  watch: "Gallery",
};

/**
 * One sequential test: the sidebar reads module-level signals, so a second
 * test running beside it would see this one's table.
 */
describe("the game sidebar", () => {
  it("renders the rows and the presets its game hands it", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const chosen: SeatPreset[] = [];

    settled(() =>
      render(
        <GameSidebar
          log={
            <div>
              <div>1. e4 e5</div>
              <div>2. Nf3 Nc6</div>
            </div>
          }
          logEntries={["e4", "e5", "Nf3", "Nc6"]}
          turnStatus={<div>Your turn...</div>}
          isProcessing={false}
          appMode="local"
          seats={{ w: HUMAN_SEAT, b: HUMAN_SEAT }}
          presets={{
            names: ["watch", "hybrid"],
            label: preset => LABELS[preset],
            active: "hybrid",
            onChange: preset => chosen.push(preset),
          }}
          onNewGame={() => undefined}
          onBackToHome={() => undefined}
        />,
        root,
      ),
    );

    expect(root.textContent).toContain("Game log");
    expect(root.textContent).toContain("1. e4 e5");
    expect(root.textContent).toContain("2. Nf3 Nc6");
    expect(root.textContent).toContain("Your turn...");

    const presetButtons = [...root.querySelectorAll("button")].filter(button =>
      Object.values(LABELS).includes(button.textContent ?? ""),
    );
    expect(presetButtons.map(button => button.textContent)).toEqual([
      "Gallery",
      "Duel",
    ]);
    expect(root.textContent).not.toContain("Engine");

    const hybrid = presetButtons[1];
    if (hybrid === undefined) throw new Error("no Duel button");
    expect(hybrid.style.fontWeight).toBe("700");
    settled(() => {
      hybrid.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(chosen).toEqual(["hybrid"]);

    expect(root.textContent).toContain("New Game");
    expect(root.textContent).toContain("End Game");
    // A table with no LLM seat keeps the consensus viewer out of the sidebar
    expect(root.textContent).not.toContain("Consensus Viewer");

    render(null, root);
    root.remove();
  });
});
