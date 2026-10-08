import { beforeAll, describe, expect, it, mock } from "bun:test";
import { render } from "preact";
import { registerHappyDom } from "../happy-dom.test-fixture";
import { DEFAULT_LLM_SEAT, type LlmSeatConfig } from "../core/seats";
import { ModelPicker } from "./ModelPicker";

beforeAll(registerHappyDom);

const seats = [
  {
    playerId: "Matrix",
    config: { ...DEFAULT_LLM_SEAT, models: ["jev" as const] },
  },
  {
    playerId: "Cortex",
    config: { ...DEFAULT_LLM_SEAT, models: ["jev" as const] },
  },
];

const renderPicker = () => {
  const onChange = mock((_playerId: string, _config: LlmSeatConfig) => {});
  const container = document.createElement("div");
  document.body.appendChild(container);
  render(<ModelPicker seats={seats} onChange={onChange} />, container);
  const box = (label: string) => {
    const input = container.querySelector(`[aria-label="${label}"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`no ${label}`);
    return input;
  };
  return { onChange, box };
};

describe("the model picker", () => {
  it("shows every LLM seat's roster side by side", () => {
    const { box } = renderPicker();
    expect(box("Jev for Matrix").checked).toBe(true);
    expect(box("Jev for Cortex").checked).toBe(true);
    expect(box("Nova Micro for Cortex").checked).toBe(false);
  });

  it("changes only the seat whose column was clicked", () => {
    const { onChange, box } = renderPicker();
    box("Nova Micro for Cortex").click();
    expect(onChange).toHaveBeenCalledTimes(1);
    const [playerId, config] = onChange.mock.calls[0] ?? [];
    expect(playerId).toBe("Cortex");
    expect(config?.models).toEqual(["jev", "nova-micro"]);
  });
});
