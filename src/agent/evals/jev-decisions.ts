import { askJev } from "../jev-choice";
import { getLegalActions } from "../legal-actions";
import { stripReasoning } from "../../types/action";
import { jevCases } from "./jev-cases";

// Opt-in live evaluation of Jev's picks. Prints one JSON line per case and a
// summary table; nonzero exit when any acceptable-rate regression is visible.
// Usage: JEV_REPEATS=1 bun src/agent/evals/jev-decisions.ts
if (!process.env.AI_GATEWAY_API_KEY)
  throw new Error("AI_GATEWAY_API_KEY is required for live evaluations");
const repeats = Number(process.env.JEV_REPEATS ?? 1);
const modelId = process.env.JEV_MODEL ?? "typesafe-ai/jev";
const only = process.env.JEV_ONLY?.split(",").filter(Boolean);

const sameAction = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const rows: Array<{
  id: string;
  pick: string;
  acceptable: boolean;
  pAcceptable: number;
  confidence: number | undefined;
  ms: number;
}> = [];

for (const scenario of jevCases()) {
  if (only && !only.includes(scenario.id)) continue;
  const legalActions = getLegalActions(scenario.state);
  const acceptableKeys = new Set(
    legalActions
      .map((action, index) => ({ action, index }))
      .filter(({ action }) =>
        scenario.acceptable.some(a =>
          sameAction(stripReasoning(a), stripReasoning(action)),
        ),
      )
      .map(({ index }) => index),
  );
  if (acceptableKeys.size === 0)
    throw new Error(`${scenario.id}: no acceptable action is legal`);
  for (let repeat = 0; repeat < repeats; repeat++) {
    const started = performance.now();
    const vote = await askJev({
      modelId,
      currentState: scenario.state,
      legalActions,
      customStrategy: scenario.customStrategy,
      abortSignal: AbortSignal.timeout(60_000),
    }).catch((error: unknown) => {
      console.log(
        JSON.stringify({
          id: scenario.id,
          error: String(error),
          ms: Math.round(performance.now() - started),
        }),
      );
      return null;
    });
    if (!vote) {
      rows.push({
        id: scenario.id,
        pick: "ERROR",
        acceptable: false,
        pAcceptable: 0,
        confidence: undefined,
        ms: Math.round(performance.now() - started),
      });
      continue;
    }
    const ms = Math.round(performance.now() - started);
    const pickedIndex = legalActions.findIndex(a =>
      sameAction(stripReasoning(a), stripReasoning(vote.action)),
    );
    const probabilities = vote.answer.probabilities ?? {};
    const pAcceptable = Object.entries(probabilities)
      .filter(([key]) => acceptableKeys.has(Number(key.split(".")[0]) - 1))
      .reduce((sum, [, p]) => sum + p, 0);
    const row = {
      id: scenario.id,
      pick:
        vote.action.type +
        ("card" in vote.action && vote.action.card
          ? `:${vote.action.card}`
          : ""),
      acceptable: acceptableKeys.has(pickedIndex),
      pAcceptable: Number(pAcceptable.toFixed(2)),
      confidence:
        vote.confidence === undefined
          ? undefined
          : Number(vote.confidence.toFixed(2)),
      ms,
    };
    rows.push(row);
    console.log(
      JSON.stringify({
        ...row,
        probes: scenario.probes,
        reasoning: vote.action.reasoning,
      }),
    );
  }
}

const passed = rows.filter(r => r.acceptable).length;
const mean = (xs: number[]) =>
  xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
console.log(
  `\nJEV ${modelId}: acceptable ${passed}/${rows.length} (${Math.round((100 * passed) / rows.length)}%), mean p(acceptable) ${mean(rows.map(r => r.pAcceptable)).toFixed(2)}, mean latency ${Math.round(mean(rows.map(r => r.ms)))}ms`,
);
console.log(
  ["id", "pick", "ok", "p(ok)", "conf", "ms"].join("\t") +
    "\n" +
    rows
      .map(r =>
        [
          r.id,
          r.pick,
          r.acceptable ? "yes" : "NO",
          r.pAcceptable,
          r.confidence ?? "-",
          r.ms,
        ].join("\t"),
      )
      .join("\n"),
);
process.exit(passed === rows.length ? 0 : 1);
