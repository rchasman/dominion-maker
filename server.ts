// Simple Bun HTTP server for local API development
import generateActionHandler from "./api/generate-action";
import analyzeStrategyHandler from "./api/analyze-strategy";
import strategyReactHandler from "./api/strategy-react";
import patrickChatHandler from "./api/patrick-chat";
import { serverLogger } from "./src/lib/logger";
import { run } from "./src/lib/run";

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
      url.pathname === "/api/analyze-strategy" ||
      url.pathname === "/api/strategy-react" ||
      url.pathname === "/api/patrick-chat"
    ) {
      // Adapt Bun Request to Vercel-style request/response
      const body = await req.text();
      const vercelReq: VercelRequest = {
        method: req.method,
        body: JSON.parse(body),
      };

      type ResponseState = {
        statusCode: number;
        responseData: unknown;
        responseHeaders: Record<string, string>;
      };

      const initialState: ResponseState = {
        statusCode: HTTP_OK,
        responseData: null,
        responseHeaders: {},
      };

      // Use a mutable ref to capture response state
      const responseState = { current: initialState };

      const vercelRes: VercelResponse = {
        status: (code: number) => {
          responseState.current = {
            ...responseState.current,
            statusCode: code,
          };
          return vercelRes;
        },
        json: (data: unknown) => {
          responseState.current = {
            ...responseState.current,
            responseData: data,
          };
          return vercelRes;
        },
        send: (data: string) => {
          responseState.current = {
            ...responseState.current,
            responseData: data,
          };
          return vercelRes;
        },
        setHeader: (key: string, value: string) => {
          responseState.current = {
            ...responseState.current,
            responseHeaders: {
              ...responseState.current.responseHeaders,
              [key]: value,
            },
          };
          return vercelRes;
        },
      };

      // Route to appropriate handler
      const handler = run(() => {
        if (url.pathname === "/api/generate-action")
          return generateActionHandler;
        if (url.pathname === "/api/strategy-react") return strategyReactHandler;
        if (url.pathname === "/api/patrick-chat") return patrickChatHandler;
        return analyzeStrategyHandler;
      });
      await handler(vercelReq, vercelRes);

      const { statusCode, responseData, responseHeaders } =
        responseState.current;

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
