// Utility for inline complex expressions without IIFEs
// https://maxgreenwald.me/blog/do-more-with-run
export const run = <T>(f: () => T): T => {
  return f();
};
