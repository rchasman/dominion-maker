/** "1 card", "2 cards": a count with its noun, for nouns that pluralise with an s */
export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;
