// Bun HTTP server for local API development and smoke checks.
import { handleApiRequest } from "./api/_router";
import { serverLogger } from "./src/lib/logger";

const DEFAULT_SERVER_PORT = 5174;
const port =
  process.env.PORT === undefined
    ? DEFAULT_SERVER_PORT
    : Number(process.env.PORT);
import { serve } from "bun";
const server = serve({ port, fetch: handleApiRequest });
serverLogger.info(`API server running at http://localhost:${server.port}`);

const shutdown = async () => {
  await server.stop(true);
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
