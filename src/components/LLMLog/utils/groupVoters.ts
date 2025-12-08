import { getModelColor } from "../../../config/models";

export interface GroupedVoter {
  name: string;
  count: number;
  color: string;
}

// Helper to group voters by model name and show counts
export const groupVotersByModel = (voters: string[]): string => {
  const counts = new Map<string, number>();
  voters.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => count > 1 ? `${name} ×${count}` : name)
    .join(", ");
};

// Helper to group voters with their colors for visualization
export const groupVotersWithColors = (voters: string[]): GroupedVoter[] => {
  const counts = new Map<string, number>();
  voters.forEach(voter => {
    counts.set(voter, (counts.get(voter) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
    color: getModelColor(name)
  }));
};
