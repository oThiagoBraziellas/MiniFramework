import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeItems, shuffle, reverse, sortById, removeItem, insertAt, nextId } from '../demo/model.js';

test('makeItems builds sequential items', () => {
  assert.deepEqual(makeItems(3), [{ id: 1, label: 'Item 1' }, { id: 2, label: 'Item 2' }, { id: 3, label: 'Item 3' }]);
  assert.equal(makeItems(2, 10)[1].id, 11);
});

test('shuffle is a permutation, deterministic for a given random source, and does not mutate', () => {
  const items = makeItems(20);
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = shuffle(items, rand);
  assert.deepEqual(sortById(out), items);
  assert.notDeepEqual(out, items);
  seed = 1;
  assert.deepEqual(shuffle(items, rand), out);
  assert.equal(items[0].id, 1);
});

test('reverse, sort, remove, insert and nextId', () => {
  const items = makeItems(4);
  assert.deepEqual(reverse(items).map((i) => i.id), [4, 3, 2, 1]);
  assert.deepEqual(sortById(reverse(items)), items);
  assert.deepEqual(removeItem(items, 2).map((i) => i.id), [1, 3, 4]);
  assert.deepEqual(insertAt(items, 1, { id: 9 }).map((i) => i.id), [1, 9, 2, 3, 4]);
  assert.equal(insertAt(items, 99, { id: 9 }).at(-1).id, 9);
  assert.equal(insertAt(items, -5, { id: 9 })[0].id, 9);
  assert.equal(nextId(items), 5);
  assert.equal(nextId([]), 1);
});
