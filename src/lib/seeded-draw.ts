/**
 * One deterministic draw from a piece of text, so a rules bot answers the
 * same position with the same move every time and still varies by position.
 */

/** FNV-1a over the text, so the same text always seeds the same draw */
const hashOf = (text: string): number =>
  [...text].reduce(
    (hash, character) =>
      Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );

/** One mulberry32 step, written without the usual mutable generator state */
const firstDraw = (seed: number): number => {
  const a = (seed + 0x9e3779b9) >>> 0;
  const b = Math.imul(a ^ (a >>> 15), 1 | a);
  const c = (b + Math.imul(b ^ (b >>> 7), 61 | b)) >>> 0;
  return ((c ^ (c >>> 14)) >>> 0) / 4294967296;
};

/** The index a text picks out of `length` choices */
export const seededIndex = (text: string, length: number): number =>
  Math.floor(firstDraw(hashOf(text)) * length);
