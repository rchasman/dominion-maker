import { Logger } from "tslog";

// Configure logger with beautiful formatting
export const logger = new Logger({
  type: "pretty",
  minLevel: 3, // info and above (0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal)
  hideLogPositionForProduction: process.env.NODE_ENV === "production",
  prettyLogTemplate: "{{hh}}:{{MM}}:{{ss}} {{logLevelName}} {{name}} ",
  prettyLogStyles: {
    logLevelName: {
      "*": ["bold", "black", "bgWhiteBright", "dim"],
      SILLY: ["bold", "white"],
      TRACE: ["bold", "whiteBright"],
      DEBUG: ["bold", "green"],
      INFO: ["bold", "blue"],
      WARN: ["bold", "yellow"],
      ERROR: ["bold", "red"],
      FATAL: ["bold", "redBright"],
    },
    dateIsoStr: "white",
    filePathWithLine: "white",
    name: ["white", "bold"],
    nameWithDelimiterPrefix: ["white", "bold"],
    nameWithDelimiterSuffix: ["white", "bold"],
    errorName: ["bold", "bgRedBright", "whiteBright"],
    fileName: ["yellow"],
  },
});

// Create sub-loggers for different parts of the application
export const engineLogger = logger.getSubLogger({ name: "⚙ engine" });
export const agentLogger = logger.getSubLogger({ name: "◈ agent" });
export const apiLogger = logger.getSubLogger({ name: "◉ api" });
export const serverLogger = logger.getSubLogger({ name: "◆ server" });
export const multiplayerLogger = logger.getSubLogger({ name: "◇ multiplayer" });
export const uiLogger = logger.getSubLogger({ name: "◇ ui" });
