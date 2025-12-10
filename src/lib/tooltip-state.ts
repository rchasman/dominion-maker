const TOOLTIP_RESET_DELAY = 200;

const tooltipState = {
  activeGlobal: false,
  hasShownFirstTooltip: false,
  resetTimeoutId: null as NodeJS.Timeout | null,
};

export function isTooltipActive(): boolean {
  return tooltipState.activeGlobal;
}

export function isFirstTooltip(): boolean {
  return !tooltipState.hasShownFirstTooltip;
}

export function setTooltipActive(active: boolean): void {
  if (tooltipState.resetTimeoutId) {
    clearTimeout(tooltipState.resetTimeoutId);
    tooltipState.resetTimeoutId = null;
  }

  if (active) {
    tooltipState.activeGlobal = true;
    tooltipState.hasShownFirstTooltip = true;
  } else {
    tooltipState.resetTimeoutId = setTimeout(() => {
      tooltipState.activeGlobal = false;
    }, TOOLTIP_RESET_DELAY);
  }
}
