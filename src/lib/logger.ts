// Lightweight logger using native console with ANSI colors
// Replaces tslog to save ~28KB from bundle

type LogLevel = "debug" | "info" | "warn" | "error";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  white: "\x1b[37m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

class SimpleLogger {
  constructor(private name: string) {}

  private log(level: LogLevel, ...args: unknown[]) {
    const TIMESTAMP_START = 11;
    const TIMESTAMP_END = 23;
    const timestamp = new Date().toISOString().slice(TIMESTAMP_START, TIMESTAMP_END); // HH:MM:SS.mmm

    const levelColor = {
      debug: colors.green,
      info: colors.blue,
      warn: colors.yellow,
      error: colors.red,
    }[level];

    const levelName = `${levelColor}${colors.bold}${level.toUpperCase()}${colors.reset}`;
    const prefix = `${timestamp} ${levelName} ${colors.bold}${colors.white}${this.name}${colors.reset}`;

    console[level](prefix, ...args);
  }

  debug(...args: unknown[]) {
    this.log("debug", ...args);
  }

  info(...args: unknown[]) {
    this.log("info", ...args);
  }

  warn(...args: unknown[]) {
    this.log("warn", ...args);
  }

  error(...args: unknown[]) {
    this.log("error", ...args);
  }

  getSubLogger(opts: { name: string }) {
    return new SimpleLogger(opts.name);
  }
}

export const logger = new SimpleLogger("app");

// Create sub-loggers for different parts of the application
export const engineLogger = logger.getSubLogger({ name: "⚙ engine" });
export const agentLogger = logger.getSubLogger({ name: "◈ agent" });
export const apiLogger = logger.getSubLogger({ name: "◉ api" });
export const serverLogger = logger.getSubLogger({ name: "◆ server" });
export const multiplayerLogger = logger.getSubLogger({ name: "◇ multiplayer" });
export const uiLogger = logger.getSubLogger({ name: "◇ ui" });
