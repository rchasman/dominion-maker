import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  logger,
  engineLogger,
  agentLogger,
  apiLogger,
  serverLogger,
  multiplayerLogger,
  uiLogger,
} from "./logger";

describe("logger", () => {
  let originalConsole: {
    debug: typeof console.debug;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  beforeEach(() => {
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    console.debug = mock(() => {});
    console.info = mock(() => {});
    console.warn = mock(() => {});
    console.error = mock(() => {});
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("has main logger instance", () => {
    expect(logger).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it("creates sub-loggers", () => {
    expect(engineLogger).toBeDefined();
    expect(agentLogger).toBeDefined();
    expect(apiLogger).toBeDefined();
    expect(serverLogger).toBeDefined();
    expect(multiplayerLogger).toBeDefined();
    expect(uiLogger).toBeDefined();
  });

  it("logs debug messages", () => {
    logger.debug("test message");
    expect(console.debug).toHaveBeenCalled();
  });

  it("logs info messages", () => {
    logger.info("test message");
    expect(console.info).toHaveBeenCalled();
  });

  it("logs warn messages", () => {
    logger.warn("test message");
    expect(console.warn).toHaveBeenCalled();
  });

  it("logs error messages", () => {
    logger.error("test message");
    expect(console.error).toHaveBeenCalled();
  });

  it("sub-logger can create another sub-logger", () => {
    const subLogger = logger.getSubLogger({ name: "test" });
    expect(subLogger).toBeDefined();
    expect(subLogger.debug).toBeDefined();
  });

  it("logs with multiple arguments", () => {
    logger.info("message", { key: "value" }, [1, 2, 3]);
    expect(console.info).toHaveBeenCalled();
  });

  it("sub-loggers log independently", () => {
    engineLogger.debug("engine message");
    agentLogger.info("agent message");
    expect(console.debug).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });
});
