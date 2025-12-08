let tooltipActiveGlobal = false;
let resetTimeoutId: NodeJS.Timeout | null = null;

export function isTooltipActive(): boolean {
  return tooltipActiveGlobal;
}

export function setTooltipActive(active: boolean): void {
  if (resetTimeoutId) {
    clearTimeout(resetTimeoutId);
    resetTimeoutId = null;
  }

  if (active) {
    tooltipActiveGlobal = true;
  } else {
    resetTimeoutId = setTimeout(() => {
      tooltipActiveGlobal = false;
    }, 200);
  }
}
