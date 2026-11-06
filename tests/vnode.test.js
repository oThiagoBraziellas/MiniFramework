import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h, normalizeChildren, createTextVNode, TEXT } from '../src/vnode.js';
import { defineComponent } from '../src/component.js';

test('h creates element vnodes and extracts the key', () => {
  const v = h('div', { id: 'a', key: 'k' }, 'hi');
  assert.equal(v.type, 'div');
  assert.equal(v.key, 'k');
  assert.deepEqual(v.props, { id: 'a' });
  assert.deepEqual(v.children.map((c) => [c.type, c.text]), [[TEXT, 'hi']]);
});

test('h accepts null props and keeps the key null by default', () => {
  const v = h('p', null, 'x');
  assert.equal(v.key, null);
  assert.deepEqual(v.props, {});
});

test('children are flattened and cleaned', () => {
  const v = h('ul', null, [h('li'), [h('li'), null]], false, undefined, true, 0, 'x');
  assert.deepEqual(v.children.map((c) => c.type), ['li', 'li', TEXT, TEXT]);
  assert.deepEqual(v.children.slice(2).map((c) => c.text), ['0', 'x']);
});

test('normalizeChildren handles deep arrays and numbers', () => {
  assert.deepEqual(normalizeChildren([[[1], [2, [3]]]]).map((c) => c.text), ['1', '2', '3']);
  assert.deepEqual(normalizeChildren(null), []);
});

test('text vnodes', () => {
  assert.deepEqual(createTextVNode(5), { type: TEXT, text: '5', props: {}, children: [], key: null });
});

test('components receive children inside props', () => {
  const Box = (props) => h('div', null, props.children);
  const v = h(Box, { size: 2 }, h('b'), 'x');
  assert.equal(v.type, Box);
  assert.equal(v.props.size, 2);
  assert.equal(v.props.children.length, 2);
  assert.deepEqual(v.children, []);
});

test('h rejects invalid types', () => {
  assert.throws(() => h(42), TypeError);
  assert.throws(() => h(null), TypeError);
  assert.throws(() => h({}), TypeError);
});

test('defineComponent validates and marks definitions', () => {
  const C = defineComponent({ render: () => h('i') });
  assert.equal(C.__component, true);
  assert.equal(h(C, { a: 1 }).type, C);
  assert.throws(() => defineComponent({}), TypeError);
});
