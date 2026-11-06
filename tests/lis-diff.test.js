import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longestIncreasingSubsequence as lis } from '../src/lis.js';
import { matchChildren, diffProps, diffStyle, isSameVNode } from '../src/diff.js';
import { h } from '../src/vnode.js';

const values = (seq) => lis(seq).map((i) => seq[i]);

test('lis on trivial inputs', () => {
  assert.deepEqual(lis([]), []);
  assert.deepEqual(lis([5]), [0]);
  assert.deepEqual(values([1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.equal(lis([4, 3, 2, 1]).length, 1);
});

test('lis finds a longest strictly increasing run', () => {
  assert.equal(lis([10, 9, 2, 5, 3, 7, 101, 18]).length, 4);
  assert.deepEqual(values([3, 1, 2]), [1, 2]);
  assert.equal(lis([2, 2, 2]).length, 1);
});

test('lis ignores -1 entries and returns ascending positions', () => {
  const seq = [-1, 2, -1, 0, 1, -1, 3];
  const positions = lis(seq);
  assert.deepEqual(positions.map((i) => seq[i]), [0, 1, 3]);
  assert.ok(positions.every((p, i, a) => i === 0 || a[i - 1] < p));
  assert.deepEqual(lis([-1, -1]), []);
});

test('lis agrees with a brute-force reference on random inputs', () => {
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const brute = (a) => {
    const best = a.map(() => 1);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++) if (a[j] < a[i]) best[i] = Math.max(best[i], best[j] + 1);
    return a.length ? Math.max(...best) : 0;
  };
  for (let t = 0; t < 200; t++) {
    const n = Math.floor(rand() * 30);
    const perm = Array.from({ length: n }, (_, i) => i).sort(() => rand() - 0.5);
    const result = lis(perm);
    assert.equal(result.length, brute(perm));
    for (let k = 1; k < result.length; k++) assert.ok(perm[result[k - 1]] < perm[result[k]] && result[k - 1] < result[k]);
  }
});

const keyed = (...keys) => keys.map((k) => h('li', { key: k }, k));

test('matchChildren pairs keyed children regardless of position', () => {
  const { matches, removed } = matchChildren(keyed('a', 'b', 'c'), keyed('c', 'a', 'b'));
  assert.deepEqual(matches, [2, 0, 1]);
  assert.deepEqual(removed, []);
});

test('matchChildren reports new and removed children', () => {
  const { matches, removed } = matchChildren(keyed('a', 'b', 'c'), keyed('b', 'x', 'c'));
  assert.deepEqual(matches, [1, -1, 2]);
  assert.deepEqual(removed, [0]);
});

test('matchChildren computes the stable set via LIS: moving one item moves only that item', () => {
  const { stable } = matchChildren(keyed('a', 'b', 'c', 'd', 'e'), keyed('b', 'c', 'd', 'e', 'a'));
  assert.deepEqual([...stable].sort(), [0, 1, 2, 3]); // only "a" (new index 4) has to move
  const reversed = matchChildren(keyed('a', 'b', 'c', 'd'), keyed('d', 'c', 'b', 'a'));
  assert.equal(reversed.stable.size, 1);
});

test('matchChildren matches unkeyed children by order and type', () => {
  const old = [h('p'), h('span'), h('p')];
  const next = [h('p'), h('p'), h('p')];
  const { matches, removed } = matchChildren(old, next);
  assert.deepEqual(matches, [0, -1, 2]);
  assert.deepEqual(removed, [1]);
});

test('matchChildren does not match across different types even with equal keys', () => {
  const { matches, removed } = matchChildren([h('li', { key: 'a' })], [h('div', { key: 'a' })]);
  assert.deepEqual(matches, [-1]);
  assert.deepEqual(removed, [0]);
});

test('duplicate keys: the first claims the old node, the second is created', () => {
  const { matches, removed } = matchChildren(keyed('a'), keyed('a', 'a'));
  assert.deepEqual(matches, [0, -1]);
  assert.deepEqual(removed, []);
});

test('matchChildren handles empty lists', () => {
  assert.deepEqual(matchChildren([], []).matches, []);
  assert.deepEqual(matchChildren([], keyed('a')).matches, [-1]);
  assert.deepEqual(matchChildren(keyed('a'), []).removed, [0]);
});

test('isSameVNode compares type and key', () => {
  assert.equal(isSameVNode(h('li', { key: 1 }), h('li', { key: 1 })), true);
  assert.equal(isSameVNode(h('li', { key: 1 }), h('li', { key: 2 })), false);
  assert.equal(isSameVNode(h('li'), h('div')), false);
});

test('diffProps returns changed, added and removed props', () => {
  const fn = () => {};
  const d = diffProps({ a: 1, b: 2, onClick: fn }, { a: 1, b: 3, c: 4, onClick: fn });
  assert.deepEqual(d.set, { b: 3, c: 4 });
  assert.deepEqual(d.remove, []);
  assert.deepEqual(diffProps({ a: 1, b: 2 }, { a: 1 }).remove, ['b']);
  assert.deepEqual(diffProps({}, {}), { set: {}, remove: [] });
  assert.deepEqual(diffProps({ children: [1] }, { children: [2] }), { set: {}, remove: [] });
});

test('diffStyle', () => {
  assert.deepEqual(diffStyle({ color: 'red', top: '1px' }, { color: 'blue', left: '2px' }), {
    set: { color: 'blue', left: '2px' },
    remove: ['top'],
  });
  assert.deepEqual(diffStyle(undefined, undefined), { set: {}, remove: [] });
});
