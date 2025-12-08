// Simple Bun HTTP server for local API development
import handler from "./api/generate-action";
import { serverLogger } from "./src/lib/logger";

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
      // Adapt Bun Request to Vercel-style request/response
      const body = await req.text();
      const vercelReq = {
        method: req.method,
        body: JSON.parse(body),
      };

      let statusCode = 200;
      let responseData: unknown = null;
      const responseHeaders: Record<string, string> = {};

      const vercelRes = {
        status: (code: number) => {
          statusCode = code;
          return vercelRes;
        },
        json: (data: unknown) => {
          responseData = data;
          return vercelRes;
        },
        send: (data: string) => {
          responseData = data;
          return vercelRes;
        },
        setHeader: (key: string, value: string) => {
          responseHeaders[key] = value;
          return vercelRes;
        },
      };

      await handler(vercelReq, vercelRes);

      return new Response(
        typeof responseData === "string" ? responseData : JSON.stringify(responseData),
        {
          status: statusCode,
          headers: {
            ...responseHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
});

serverLogger.info(`API server running at http://localhost:${server.port}`);

// Graceful shutdown handling
process.on("SIGTERM", () => {
  serverLogger.info("SIGTERM received, shutting down gracefully");
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  serverLogger.info("SIGINT received, shutting down gracefully");
  server.stop();
  process.exit(0);
});
