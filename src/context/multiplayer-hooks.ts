import { useContext } from "preact/compat";
import { MultiplayerContext } from "./MultiplayerContext";

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error("useMultiplayer must be used within MultiplayerProvider");
  }
  return context;
}
