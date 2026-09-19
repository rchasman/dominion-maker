const VOTE_DECIMALS = 1;

/** "3×" for whole counts, "2.6×"-style for fractional ones */
export const formatVoteCount = (count: number): string =>
  Number.isInteger(count) ? `${count}` : count.toFixed(VOTE_DECIMALS);
