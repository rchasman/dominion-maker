# Factual grounding evaluations

Run from the repository root with an AI Gateway key available (Bun loads local env files):

```sh
EVAL_MODELS=gpt-5.4-nano,gemini-3.1-flash-lite EVAL_REPEATS=3 bun src/agent/evals/run.ts > /tmp/dominion-grounding.jsonl
```

This is an opt-in live evaluation and incurs model usage. `EVAL_JUDGE` defaults to `gpt-5.4`; model aliases use the app's existing configuration. Each case exercises the production action and analysis prompt builders. Cases cover Witch/Bandit confusion, exhausted Curse supply, false legacy commentary, and false conditional advice.

Action legality is checked by the production numbered-choice schema. The judge must quote each alleged error from the candidate; absent quotes or inconsistent verdicts fail as assessment errors. Factual accuracy and relevance receive a separate model assessment against card definitions, current context and a case rubric. An analysis has no action legality score. Output includes each response and assessment for human review; judge grades are fallible, not factual certification. Nonzero exit means an assessment failed or a call failed; errors are recorded separately and do not count as successful evaluations.

For before/after comparisons, use the same models, judge, cases and repeat count on each revision. One passing run is a smoke check, not an error-rate estimate. Keep JSONL results and working reports in `/tmp`; commit reusable cases and regression tests only.
