// Simple Bun HTTP server for local API development
import generateActionHandler from "./api/generate-action";
import analyzeStrategyHandler from "./api/analyze-strategy";
import { serverLogger } from "./src/lib/logger";

// HTTP Status Codes
const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const HTTP_OK = 200;

// Server Configuration
const SERVER_PORT = 5174;
const EXIT_CODE_SUCCESS = 0;

// Type definitions for Bun server
interface BunRequest {
  method: string;
  url: string;
  text(): Promise<string>;
}

interface BunServer {
  port: number;
  stop(): void;
}

interface BunServeOptions {
  port: number;
  fetch: (req: BunRequest) => Promise<Response>;
}

// Declare global Bun object for TypeScript
declare const Bun: {
  serve(options: BunServeOptions): BunServer;
};

interface VercelRequest {
  method?: string;
  body?: unknown;
  text?: () => Promise<string>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
  send: (data: string) => VercelResponse;
  setHeader: (key: string, value: string) => VercelResponse;
}

const server = Bun.serve({
  port: SERVER_PORT,
  async fetch(req: BunRequest) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: HTTP_NO_CONTENT,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Route API requests
    if (
      url.pathname === "/api/generate-action" ||
      url.pathname === "/api/analyze-strategy"
    ) {
      // Adapt Bun Request to Vercel-style request/response
      const body = await req.text();
      const vercelReq: VercelRequest = {
        method: req.method,
        body: JSON.parse(body),
      };

      let statusCode = HTTP_OK;
      let responseData: unknown = null;
      const responseHeaders: Record<string, string> = {};

      const vercelRes: VercelResponse = {
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

      // Route to appropriate handler
      const handler =
        url.pathname === "/api/generate-action"
          ? generateActionHandler
          : analyzeStrategyHandler;
      await handler(vercelReq, vercelRes);

      return new Response(
        typeof responseData === "string"
          ? responseData
          : JSON.stringify(responseData),
        {
          status: statusCode,
          headers: {
            ...responseHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response("Not Found", { status: HTTP_NOT_FOUND });
  },
});

serverLogger.info(`API server running at http://localhost:${server.port}`);

// Graceful shutdown handling
process.on("SIGTERM", () => {
  serverLogger.info("SIGTERM received, shutting down gracefully");
  server.stop();
  process.exit(EXIT_CODE_SUCCESS);
});

process.on("SIGINT", () => {
  serverLogger.info("SIGINT received, shutting down gracefully");
  server.stop();
  process.exit(EXIT_CODE_SUCCESS);
});
