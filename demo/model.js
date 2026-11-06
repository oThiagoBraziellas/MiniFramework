/** Pure helpers for the demo list. */

export function makeItems(count, start = 1) {
  return Array.from({ length: count }, (_, i) => ({ id: start + i, label: `Item ${start + i}` }));
}

/** Fisher-Yates with an injectable random source so tests are deterministic. */
export function shuffle(items, rand = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const reverse = (items) => [...items].reverse();
export const sortById = (items) => [...items].sort((a, b) => a.id - b.id);
export const removeItem = (items, id) => items.filter((item) => item.id !== id);

/** Inserts a new item at `index` (clamped). */
export function insertAt(items, index, item) {
  const i = Math.min(Math.max(index, 0), items.length);
  return [...items.slice(0, i), item, ...items.slice(i)];
}

export function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}
