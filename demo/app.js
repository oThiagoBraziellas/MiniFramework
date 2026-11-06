import { h, defineComponent, createRenderer } from '../src/index.js';
import { makeItems, shuffle, reverse, sortById, removeItem, insertAt, nextId } from './model.js';

const renderer = createRenderer();

/** Independent counter: each instance owns its state. */
const Counter = defineComponent({
  name: 'Counter',
  state: (props) => ({ n: props.start ?? 0 }),
  render({ props, state, setState }) {
    return h('div', { className: 'counter' },
      h('span', { className: 'label' }, props.label),
      h('button', { onClick: () => setState((s) => ({ n: s.n - 1 })), 'aria-label': 'decrement' }, '−'),
      h('output', null, state.n),
      h('button', { onClick: () => setState((s) => ({ n: s.n + 1 })), 'aria-label': 'increment' }, '+'));
  },
});

/** A row with local state (a counter) and an uncontrolled input, to make key behaviour visible. */
const Row = defineComponent({
  name: 'Row',
  state: () => ({ clicks: 0 }),
  render({ props, state, setState }) {
    return h('li', { className: 'row' },
      h('span', { className: 'id' }, `#${props.item.id}`),
      h('span', { className: 'name' }, props.item.label),
      h('input', { placeholder: 'type here', 'aria-label': `Note for ${props.item.label}` }),
      h('button', { onClick: () => setState((s) => ({ clicks: s.clicks + 1 })) }, `clicked ${state.clicks}`),
      h('button', { className: 'x', onClick: props.onRemove, 'aria-label': `Remove ${props.item.label}` }, '×'));
  },
});

const App = defineComponent({
  name: 'App',
  state: () => ({ items: makeItems(6), useKeys: true, stats: null }),
  render({ state, setState }) {
    const change = (fn) => {
      renderer.resetStats();
      setState((s) => ({ items: fn(s.items) }));
    };
    const act = (label, handler, title) => h('button', { onClick: handler, title }, label);

    return h('main', { className: 'page' },
      h('header', null,
        h('h1', null, 'MiniFramework'),
        h('p', null, 'A tiny virtual DOM: h(), keyed diffing, patching and components with state. This page is rendered with it.')),
      h('section', { className: 'card' },
        h('h2', null, 'Components with state'),
        h(Counter, { label: 'A', start: 0 }),
        h(Counter, { label: 'B', start: 10 }),
        h('p', { className: 'muted' }, 'Each instance keeps its own state. State updates are batched and re-render only the owning component.')),
      h('section', { className: 'card' },
        h('h2', null, 'Keyed children'),
        h('p', { className: 'muted' }, 'Type something in a row, click its counter, then shuffle. With keys the text and the counter follow the item. Without keys they stay in the slot.'),
        h('div', { className: 'toolbar' },
          act('Shuffle', () => change((items) => shuffle(items))),
          act('Reverse', () => change(reverse)),
          act('Sort', () => change(sortById)),
          act('Add first', () => change((items) => insertAt(items, 0, { id: nextId(items), label: `Item ${nextId(items)}` }))),
          act('Add middle', () => change((items) => insertAt(items, Math.floor(items.length / 2), { id: nextId(items), label: `Item ${nextId(items)}` }))),
          h('label', { className: 'check' },
            h('input', { type: 'checkbox', checked: state.useKeys, onChange: (e) => { renderer.resetStats(); setState({ useKeys: e.target.checked }); } }),
            ' use keys')),
        h('ul', { className: 'list' },
          state.items.map((item) => h(Row, {
            key: state.useKeys ? item.id : null,
            item,
            onRemove: () => change((items) => removeItem(items, item.id)),
          }))),
        h('pre', { className: 'stats', id: 'stats' }, 'DOM operations for the last update will appear here.')));
  },
  mounted: showStats,
  updated: showStats,
});

function showStats() {
  const s = renderer.stats;
  const el = document.getElementById('stats');
  if (!el) return;
  el.textContent = `Last update: ${s.created} nodes created, ${s.removed} removed, ${s.moved} moved, ${s.textUpdates} text updates, ${s.propUpdates} prop updates, ${s.componentRenders} component renders`;
}

renderer.render(h(App), document.getElementById('root'));
