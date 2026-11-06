/**
 * Longest increasing subsequence in O(n log n).
 * Entries equal to -1 are ignored (they mean "no match"). Returns the POSITIONS (indexes into
 * `values`) of one longest strictly increasing run, in ascending order.
 */
export function longestIncreasingSubsequence(values) {
  const tails = []; // tails[k] = position of the smallest tail of an increasing run of length k + 1
  const prev = new Array(values.length).fill(-1);

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === -1) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (values[tails[mid]] < v) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }

  const result = new Array(tails.length);
  let at = tails.length ? tails[tails.length - 1] : -1;
  for (let k = tails.length - 1; k >= 0; k--) {
    result[k] = at;
    at = prev[at];
  }
  return result;
}
