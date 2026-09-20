/** One entry of the `playerInfo` record carried beside a projected state */
export interface PlayerInfoEntry {
  id: string;
  name: string;
  type: "human" | "ai";
  connected: boolean;
}
