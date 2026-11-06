import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/renderer.js';
import { h } from '../src/vnode.js';
import { FakeDocument, inner } from './helpers/fake-dom.js';

function setup() {
  const doc = new FakeDocument();
  const container = doc.createContainer();
  const manual = [];
  const renderer = createRenderer({ document: doc, schedule: (fn) => manual.push(fn) });
  const tick = () => { while (manual.length) manual.shift()(); };
  return { doc, container, renderer, tick, render: (v) => renderer.render(v, container) };
}

const list = (keys, extra = {}) => h('ul', null, keys.map((k) => h('li', { key: k, ...extra }, k)));

test('mounts elements, attributes, text and nested children', () => {
  const { render, container } = setup();
  render(h('div', { id: 'app', className: 'box', 'data-x': 1 }, h('h1', null, 'Title'), 'tail'));
  assert.equal(inner(container), '<div class="box" data-x="1" id="app"><h1>Title</h1>tail</div>');
});

test('boolean attributes and null props', () => {
  const { render, container } = setup();
  render(h('input', { disabled: true, hidden: false, title: null, readonly: true }));
  assert.equal(inner(container), '<input disabled readonly></input>');
  assert.equal(container.childNodes[0].disabled, true);
});

test('style objects are applied key by key', () => {
  const { render, container } = setup();
  render(h('div', { style: { color: 'red', top: '1px' } }));
  render(h('div', { style: { color: 'blue' } }));
  assert.equal(inner(container), '<div style="color:blue"></div>');
  render(h('div', null));
  assert.equal(inner(container), '<div></div>');
});

test('updating text mutates the same text node', () => {
  const { render, container, renderer } = setup();
  render(h('p', null, 'one'));
  const textNode = container.childNodes[0].childNodes[0];
  renderer.resetStats();
  render(h('p', null, 'two'));
  assert.equal(container.childNodes[0].childNodes[0], textNode);
  assert.equal(textNode.nodeValue, 'two');
  assert.deepEqual([renderer.stats.created, renderer.stats.textUpdates], [0, 1]);
});

test('patching reuses DOM nodes and only touches changed props', () => {
  const { render, container, renderer } = setup();
  render(h('div', { id: 'a', title: 'x' }, h('span', null, 'hi')));
  const div = container.childNodes[0];
  const span = div.childNodes[0];
  renderer.resetStats();
  render(h('div', { id: 'a', title: 'y' }, h('span', null, 'hi')));
  assert.equal(container.childNodes[0], div);
  assert.equal(div.childNodes[0], span);
  assert.equal(div.getAttribute('title'), 'y');
  assert.deepEqual([renderer.stats.created, renderer.stats.removed, renderer.stats.propUpdates, renderer.stats.textUpdates], [0, 0, 1, 0]);
});

test('removed props are cleared', () => {
  const { render, container } = setup();
  render(h('div', { id: 'a', className: 'x' }));
  render(h('div', null));
  assert.equal(inner(container), '<div></div>');
});

test('changing the element type replaces the node', () => {
  const { render, container } = setup();
  render(h('div', null, h('span', null, 'a')));
  render(h('div', null, h('b', null, 'a')));
  assert.equal(inner(container), '<div><b>a</b></div>');
  render(h('section', null));
  assert.equal(inner(container), '<section></section>');
});

test('rendering null unmounts the tree', () => {
  const { render, container } = setup();
  render(h('div'));
  render(null);
  assert.equal(container.childNodes.length, 0);
  render(h('p'));
  assert.equal(inner(container), '<p></p>');
});

test('event handlers are attached once and always call the latest function', () => {
  const { render, container } = setup();
  const calls = [];
  render(h('button', { onClick: () => calls.push('first') }));
  const button = container.childNodes[0];
  render(h('button', { onClick: () => calls.push('second') }));
  assert.equal(button.listenerCount('click'), 1);
  button.dispatchEvent('click');
  assert.deepEqual(calls, ['second']);
  render(h('button', null));
  assert.equal(button.listenerCount('click'), 0);
  button.dispatchEvent('click');
  assert.deepEqual(calls, ['second']);
});

test('value is set as a property, not just an attribute', () => {
  const { render, container } = setup();
  render(h('input', { value: 'a' }));
  const input = container.childNodes[0];
  assert.equal(input.value, 'a');
  render(h('input', { value: 'b' }));
  assert.equal(input.value, 'b');
});

test('ref callbacks receive the element and null on removal', () => {
  const { render, container } = setup();
  const seen = [];
  render(h('div', null, h('input', { ref: (el) => seen.push(el && el.tagName) })));
  assert.deepEqual(seen, ['input']);
  render(h('div', null));
  assert.deepEqual(seen, ['input', null]);
  assert.equal(inner(container), '<div></div>');
});

// ---- keyed children ----------------------------------------------------------------------------

test('keyed reorder keeps every DOM node (no creation, no removal)', () => {
  const { render, container, renderer } = setup();
  render(list(['a', 'b', 'c', 'd']));
  const before = [...container.childNodes[0].childNodes];
  renderer.resetStats();
  render(list(['d', 'b', 'a', 'c']));
  const after = container.childNodes[0].childNodes;
  assert.equal(inner(container), '<ul><li>d</li><li>b</li><li>a</li><li>c</li></ul>');
  const byText = (nodes, t) => nodes.find((n) => n.childNodes[0].nodeValue === t);
  for (const t of ['a', 'b', 'c', 'd']) assert.equal(byText(after, t), byText(before, t));
  assert.equal(renderer.stats.created, 0);
  assert.equal(renderer.stats.removed, 0);
});

test('moving a single item performs exactly one DOM move', () => {
  const { render, renderer } = setup();
  render(list(['a', 'b', 'c', 'd', 'e']));
  renderer.resetStats();
  render(list(['b', 'c', 'd', 'e', 'a']));
  assert.equal(renderer.stats.moved, 1);
  renderer.resetStats();
  render(list(['e', 'b', 'c', 'd', 'a']));
  assert.ok(renderer.stats.moved <= 2);
});

test('reversing a list of n items moves n - 1 nodes', () => {
  const { render, renderer, container } = setup();
  const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);
  render(list(keys));
  renderer.resetStats();
  render(list([...keys].reverse()));
  assert.equal(renderer.stats.moved, 9);
  assert.equal(container.childNodes[0].childNodes.map((n) => n.childNodes[0].nodeValue).join(','), [...keys].reverse().join(','));
});

test('inserting and removing keyed items only creates and removes those', () => {
  const { render, container, renderer } = setup();
  render(list(['a', 'b', 'c']));
  renderer.resetStats();
  render(list(['a', 'x', 'b', 'c']));
  assert.equal(renderer.stats.created, 2); // li + text
  assert.equal(renderer.stats.moved, 0);
  assert.equal(inner(container), '<ul><li>a</li><li>x</li><li>b</li><li>c</li></ul>');
  renderer.resetStats();
  render(list(['b', 'c']));
  assert.equal(renderer.stats.removed, 2);
  assert.equal(renderer.stats.created, 0);
  assert.equal(inner(container), '<ul><li>b</li><li>c</li></ul>');
});

test('keyed elements keep their own DOM state when reordered', () => {
  const { render, container } = setup();
  const items = (keys) => h('div', null, keys.map((k) => h('input', { key: k, 'data-k': k })));
  render(items(['a', 'b']));
  const [a, b] = container.childNodes[0].childNodes;
  a.typed = 'text for a';
  render(items(['b', 'a']));
  const [first, second] = container.childNodes[0].childNodes;
  assert.equal(first, b);
  assert.equal(second, a);
  assert.equal(second.typed, 'text for a');
});

test('without keys, items are matched by position', () => {
  const { render, container } = setup();
  const items = (labels) => h('div', null, labels.map((l) => h('input', { 'data-l': l })));
  render(items(['a', 'b']));
  const [first] = container.childNodes[0].childNodes;
  first.typed = 'typed in first slot';
  render(items(['b', 'a']));
  assert.equal(container.childNodes[0].childNodes[0], first);
  assert.equal(first.getAttribute('data-l'), 'b');
  assert.equal(first.typed, 'typed in first slot');
});

test('mixed keyed and unkeyed children render in the right order', () => {
  const { render, container } = setup();
  render(h('div', null, h('i', null, 'x'), h('b', { key: 'k' }, 'y'), h('i', null, 'z')));
  render(h('div', null, h('b', { key: 'k' }, 'y'), h('i', null, 'x'), h('i', null, 'z'), h('u', null, 'new')));
  assert.equal(inner(container), '<div><b>y</b><i>x</i><i>z</i><u>new</u></div>');
});

test('a long randomised sequence of keyed updates always yields the right DOM', () => {
  const { render, container } = setup();
  let seed = 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let pool = Array.from({ length: 12 }, (_, i) => `k${i}`);
  for (let round = 0; round < 150; round++) {
    const keys = pool.filter(() => rand() > 0.3).sort(() => rand() - 0.5);
    render(list(keys));
    assert.equal(inner(container), `<ul>${keys.map((k) => `<li>${k}</li>`).join('')}</ul>`, `round ${round}`);
  }
});

// ---- components --------------------------------------------------------------------------------

import { defineComponent } from '../src/component.js';

test('function components render with props and children', () => {
  const { render, container } = setup();
  const Card = ({ title, children }) => h('section', null, h('h2', null, title), children);
  render(h(Card, { title: 'Hello' }, h('p', null, 'body')));
  assert.equal(inner(container), '<section><h2>Hello</h2><p>body</p></section>');
  render(h(Card, { title: 'Bye' }, h('p', null, 'body')));
  assert.equal(inner(container), '<section><h2>Bye</h2><p>body</p></section>');
});

test('stateful components keep state between parent renders', () => {
  const { render, container, tick } = setup();
  let bump;
  const Counter = defineComponent({
    state: () => ({ n: 0 }),
    render({ props, state, setState }) {
      bump = () => setState((s) => ({ n: s.n + 1 }));
      return h('span', null, `${props.label}:${state.n}`);
    },
  });
  render(h('div', null, h(Counter, { label: 'a' })));
  assert.equal(inner(container), '<div><span>a:0</span></div>');
  bump();
  tick();
  assert.equal(inner(container), '<div><span>a:1</span></div>');
  render(h('div', null, h(Counter, { label: 'b' })));
  assert.equal(inner(container), '<div><span>b:1</span></div>');
});

test('setState calls are batched into a single re-render', () => {
  const { render, renderer, tick } = setup();
  let api;
  const C = defineComponent({
    state: () => ({ a: 0, b: 0 }),
    render({ state, setState }) { api = setState; return h('p', null, `${state.a}-${state.b}`); },
  });
  render(h(C));
  renderer.resetStats();
  api({ a: 1 });
  api({ b: 2 });
  api((s) => ({ a: s.a + 10 }));
  tick();
  assert.equal(renderer.stats.componentRenders, 1);
});

test('setState with an unchanged value does not schedule a render', () => {
  const { render, renderer, tick } = setup();
  let api;
  const C = defineComponent({ state: () => ({ a: 1 }), render({ state, setState }) { api = setState; return h('p', null, state.a); } });
  render(h(C));
  renderer.resetStats();
  api({ a: 1 });
  tick();
  assert.equal(renderer.stats.componentRenders, 0);
});

test('lifecycle hooks run in order: mounted after insertion, unmounted on removal', () => {
  const { render, container, tick } = setup();
  const log = [];
  let api;
  const C = defineComponent({
    state: () => ({ n: 0 }),
    render({ state, setState }) { api = setState; return h('b', null, state.n); },
    mounted({ el }) { log.push(`mounted:${el.parentNode === container}`); },
    updated() { log.push('updated'); },
    unmounted() { log.push('unmounted'); },
  });
  render(h(C));
  api({ n: 1 });
  tick();
  render(null);
  assert.deepEqual(log, ['mounted:true', 'updated', 'unmounted']);
});

test('unmounting a parent unmounts nested components and ignores later setState calls', () => {
  const { render, tick, renderer } = setup();
  const log = [];
  let childApi;
  const Child = defineComponent({
    state: () => ({ n: 0 }),
    render({ setState, state }) { childApi = setState; return h('i', null, state.n); },
    unmounted() { log.push('child gone'); },
  });
  const Parent = defineComponent({ render: () => h('div', null, h(Child)), unmounted() { log.push('parent gone'); } });
  render(h('section', null, h(Parent)));
  render(h('section', null));
  assert.deepEqual(log, ['parent gone', 'child gone']);
  renderer.resetStats();
  childApi({ n: 5 });
  tick();
  assert.equal(renderer.stats.componentRenders, 0);
});

test('a component can change its root element type', () => {
  const { render, container, tick } = setup();
  let api;
  const C = defineComponent({
    state: () => ({ big: false }),
    render({ state, setState }) { api = setState; return state.big ? h('h1', null, 'big') : h('span', null, 'small'); },
  });
  render(h('div', null, h(C), h('p', null, 'after')));
  api({ big: true });
  tick();
  assert.equal(inner(container), '<div><h1>big</h1><p>after</p></div>');
});

test('sibling components with keys keep their own state when reordered', () => {
  const { render, container, tick } = setup();
  const apis = {};
  const Item = defineComponent({
    state: () => ({ clicks: 0 }),
    render({ props, state, setState }) { apis[props.name] = setState; return h('li', null, `${props.name}:${state.clicks}`); },
  });
  const view = (names) => h('ul', null, names.map((n) => h(Item, { key: n, name: n })));
  render(view(['a', 'b', 'c']));
  apis.b({ clicks: 3 });
  tick();
  render(view(['c', 'b', 'a']));
  assert.equal(inner(container), '<ul><li>c:0</li><li>b:3</li><li>a:0</li></ul>');
});

test('nested state updates re-render parents before children', () => {
  const { render, tick } = setup();
  const order = [];
  let parentApi;
  let childApi;
  const Child = defineComponent({ state: () => ({ c: 0 }), render({ setState }) { childApi = setState; order.push('child'); return h('i'); } });
  const Parent = defineComponent({ state: () => ({ p: 0 }), render({ setState }) { parentApi = setState; order.push('parent'); return h('div', null, h(Child)); } });
  render(h(Parent));
  order.length = 0;
  childApi({ c: 1 });
  parentApi({ p: 1 });
  tick();
  assert.deepEqual(order, ['parent', 'child']);
});

test('components must return a single vnode', () => {
  const { render } = setup();
  const Bad = defineComponent({ render: () => [h('a'), h('b')] });
  assert.throws(() => render(h(Bad)), TypeError);
});

test('components returning null render an empty placeholder', () => {
  const { render, container } = setup();
  const Nothing = () => null;
  render(h('div', null, h(Nothing), h('p', null, 'x')));
  assert.equal(inner(container), '<div><p>x</p></div>');
});
