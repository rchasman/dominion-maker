import { beforeAll, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../happy-dom.test-fixture";
import { render } from "preact";
import { SeatSelector } from "./SeatSelector";
import type { ControllerConfig, LlmSeatConfig } from "../core/seats";
import { DEFAULT_LLM_SEAT } from "../core/seats";
import { players$, rememberedLlm$ } from "../context/game-signals";

beforeAll(registerHappyDom);

const pick = (root: HTMLElement, kind: string) => {
  const select = root.querySelector("select");
  if (!(select instanceof HTMLSelectElement)) throw new Error("no select");
  select.value = kind;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return select;
};

// One sequential test: the selector reads module-level signals
describe("SeatSelector", () => {
  it("names the seat after the player and restores the LLM roster it had", () => {
    players$.value = [{ id: "p1", name: "Alice" }];
    rememberedLlm$.value = {};
    const root = document.createElement("div");
    document.body.appendChild(root);
    const changes: ControllerConfig[] = [];
    const custom: LlmSeatConfig = {
      ...DEFAULT_LLM_SEAT,
      models: ["gpt-5.4-nano"],
      consensusCount: 2,
    };
    const mount = (config: ControllerConfig) =>
      render(
        <SeatSelector
          playerId="p1"
          config={config}
          options={["human", "llm"]}
          defaultLlm={DEFAULT_LLM_SEAT}
          onChange={c => changes.push(c)}
        />,
        root,
      );

    mount(custom);
    const select = pick(root, "human");
    expect(select.getAttribute("aria-label")).toBe("Controller for Alice");
    expect(changes.at(-1)).toEqual({ kind: "human" });
    expect(rememberedLlm$.value["p1"]).toEqual(custom);

    mount({ kind: "human" });
    pick(root, "llm");
    expect(changes.at(-1)).toEqual(custom);

    render(null, root);
    root.remove();
  });
});
