import generateAction from "./generate-action";
import analyzeStrategy from "./analyze-strategy";
import strategyReact from "./strategy-react";
import patrickChat from "./patrick-chat";
import type { VercelRequest, VercelResponse } from "./_http";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;
const routes: Record<string, Handler> = {
  "/api/generate-action": generateAction,
  "/api/analyze-strategy": analyzeStrategy,
  "/api/strategy-react": strategyReact,
  "/api/patrick-chat": patrickChat,
};

export async function handleApiRequest(req: Request): Promise<Response> {
  const pathname = new URL(req.url).pathname;
  if (pathname === "/health" && req.method === "GET")
    return Response.json({ status: "ok" });
  const handler = routes[pathname];
  if (!handler)
    return Response.json(
      { error: "Not found", message: "Not found" },
      { status: 404 },
    );
  const state = {
    status: 200,
    data: null as unknown,
    headers: new Headers({ "Content-Type": "application/json" }),
  };
  const res: VercelResponse = {
    status(code) {
      state.status = code;
      return res;
    },
    json(data) {
      state.data = data;
      return res;
    },
    send(data) {
      state.data = data;
      return res;
    },
    setHeader(key, value) {
      state.headers.set(key, value);
      return res;
    },
  };
  try {
    // Pass raw text through: handlers validate the method before parsing JSON.
    await handler({ method: req.method, text: () => req.text() }, res);
  } catch {
    return Response.json(
      { error: "Internal server error", message: "Internal server error" },
      { status: 500 },
    );
  }
  return new Response(
    state.status === 204 ? null : JSON.stringify(state.data),
    { status: state.status, headers: state.headers },
  );
}
