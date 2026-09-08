/** Command-local Mulberry32 stream. Only the cursor is persisted, never closures. */
export function createRandom(seed: number) {
  let cursor = seed >>> 0;
  return {
    get state() {
      return cursor;
    },
    next() {
      cursor = (cursor + 0x6d2b79f5) >>> 0;
      let value = cursor;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
  };
}
