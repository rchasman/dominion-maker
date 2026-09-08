import { spawn } from "bun";
const child = spawn([process.execPath, "server.ts"], {
  env: { ...process.env, PORT: "0" },
  stdout: "pipe",
  stderr: "inherit",
});
const reader = child.stdout.getReader();
const timer = setTimeout(() => child.kill(), 10_000);
try {
  let output = "";
  let address: string | undefined;
  while (!address) {
    const chunk = await reader.read();
    if (chunk.done)
      throw new Error(
        `Server exited before readiness (code ${await child.exited})`,
      );
    output += new TextDecoder().decode(chunk.value);
    address = output.match(/http:\/\/localhost:\d+/)?.[0];
  }
  for (const [path, method, body, expected] of [
    ["/health", "GET", undefined, 200],
    ["/api/generate-action", "GET", undefined, 405],
    ["/api/generate-action", "OPTIONS", undefined, 204],
    ["/api/generate-action", "POST", "broken JSON", 400],
    ["/api/analyze-strategy", "POST", "{}", 400],
    ["/api/patrick-chat", "POST", '{"message":42}', 400],
    ["/api/strategy-react", "POST", '{"strategy":false}', 400],
    ["/missing", "GET", undefined, 404],
  ] as const) {
    const response = await fetch(`${address}${path}`, {
      method,
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(3000),
    });
    if (response.status !== expected)
      throw new Error(
        `${method} ${path}: expected ${expected}, got ${response.status}`,
      );
    if (expected !== 204) await response.json();
  }
  console.log("Server readiness and HTTP smoke checks passed");
} finally {
  clearTimeout(timer);
  child.kill();
  await child.exited;
  await reader.cancel();
}
