/** The seat selector in one chess player's header, or null where that header shows none */
export const selectorOf = (root: HTMLElement, playerId: string) =>
  root.querySelector(`[data-chess-player="${playerId}"] select.seat-selector`);

export const optionsOf = (select: Element | null) =>
  [...(select?.querySelectorAll("option") ?? [])].map(
    option => option.textContent,
  );

/** null when there is no select at all, so a missing selector never reads as enabled */
export const isDisabled = (select: Element | null) =>
  select instanceof HTMLSelectElement ? select.disabled : null;
