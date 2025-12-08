// Simple Bun HTTP server for local API development
import handler from "./api/generate-action";

const server = Bun.serve({
  port: 5174,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Route API requests
    if (url.pathname === "/api/generate-action") {
      return handler(req);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🦊 API server running at http://localhost:${server.port}`);
