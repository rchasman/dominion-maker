export type VoteExplanation = { provider: string; reasoning?: string };

export function VoteExplanations({
  reasonings,
}: {
  reasonings: VoteExplanation[];
}) {
  const available = reasonings.filter(item => item.reasoning);
  const first = available[0];
  if (!first) return null;
  return (
    <div
      style={{
        fontSize: "0.7rem",
        color: "var(--color-text-primary)",
        lineHeight: "1.4",
        overflowWrap: "anywhere",
        marginTop: "var(--space-2)",
      }}
    >
      <div style={{ color: "var(--color-text-secondary)" }}>
        {first.provider} · Individual explanation · Not fact-checked
      </div>
      <div>{first.reasoning}</div>
      {available.length > 1 && (
        <details>
          <summary style={{ cursor: "pointer" }}>
            Other explanations ({available.length - 1})
          </summary>
          {available.slice(1).map((item, index) => (
            <div key={index} style={{ marginTop: "var(--space-2)" }}>
              <div style={{ color: "var(--color-text-secondary)" }}>
                {item.provider}
              </div>
              <div>{item.reasoning}</div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
