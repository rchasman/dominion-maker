let tooltipActiveGlobal = false;
let hasShownFirstTooltip = false;
let resetTimeoutId: NodeJS.Timeout | null = null;

export function isTooltipActive(): boolean {
  return tooltipActiveGlobal;
}

export function isFirstTooltip(): boolean {
  return !hasShownFirstTooltip;
}

export function setTooltipActive(active: boolean): void {
  if (resetTimeoutId) {
    clearTimeout(resetTimeoutId);
    resetTimeoutId = null;
  }

  if (active) {
    tooltipActiveGlobal = true;
    hasShownFirstTooltip = true;
  } else {
    resetTimeoutId = setTimeout(() => {
      tooltipActiveGlobal = false;
    }, 200);
  }
}
