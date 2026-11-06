import { TEXT, createTextVNode, isComponentVNode, isTextVNode } from './vnode.js';
import { isSameVNode, matchChildren, diffProps, diffStyle } from './diff.js';
import { normalizeComponent } from './component.js';

/** Props applied as DOM properties because attributes only set the initial value. */
const DOM_PROPS = new Set(['value', 'checked', 'selected', 'disabled', 'indeterminate']);
const BOOLEAN_ATTRS = new Set(['disabled', 'checked', 'selected', 'readonly', 'hidden', 'required', 'autofocus', 'multiple']);

const isEventProp = (name) => /^on[A-Z]/.test(name);
const eventName = (name) => name.slice(2).toLowerCase();

function shallowEqual(a, b) {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => Object.is(a[k], b[k]));
}

/**
 * Creates a renderer bound to a `document`-like object. Passing a fake document is what makes the
 * whole library testable in Node.
 */
export function createRenderer({ document: doc = globalThis.document, schedule = queueMicrotask } = {}) {
  const stats = { created: 0, removed: 0, moved: 0, propUpdates: 0, textUpdates: 0, componentRenders: 0 };
  const dirty = new Set();
  let flushScheduled = false;
  let mountQueue = [];
  let depth = 0;

  const getEl = (vnode) => (vnode.instance ? getEl(vnode.instance.vnode) : vnode.el);

  // ---- props ---------------------------------------------------------------------------------

  function setEvent(el, name, handler) {
    const type = eventName(name);
    el.__listeners = el.__listeners || {};
    const existing = el.__listeners[type];
    if (typeof handler === 'function') {
      if (existing) { existing.handler = handler; return; }
      const record = { handler, wrapper: (event) => record.handler(event) };
      el.__listeners[type] = record;
      el.addEventListener(type, record.wrapper);
    } else if (existing) {
      el.removeEventListener(type, existing.wrapper);
      delete el.__listeners[type];
    }
  }

  function setProp(el, name, value) {
    if (name === 'key' || name === 'children' || name === 'ref') return;
    if (isEventProp(name)) { setEvent(el, name, value); return; }
    if (name === 'className' || name === 'class') {
      if (value === null || value === undefined || value === false || value === '') el.removeAttribute('class');
      else el.setAttribute('class', String(value));
      return;
    }
    if (DOM_PROPS.has(name)) {
      el[name] = name === 'value' ? (value ?? '') : !!value;
      if (BOOLEAN_ATTRS.has(name)) { if (value) el.setAttribute(name, ''); else el.removeAttribute(name); }
      return;
    }
    if (value === null || value === undefined || value === false) el.removeAttribute(name);
    else el.setAttribute(name, value === true ? '' : String(value));
  }

  function applyProps(el, oldProps, newProps) {
    const { set, remove } = diffProps(oldProps, newProps);
    for (const name of Object.keys(set)) {
      stats.propUpdates += 1;
      if (name === 'style') {
        const next = set.style;
        if (typeof next === 'string') { el.setAttribute('style', next); continue; }
        const prev = typeof oldProps.style === 'object' && oldProps.style ? oldProps.style : {};
        const d = diffStyle(prev, next ?? {});
        for (const k of Object.keys(d.set)) el.style[k] = d.set[k];
        for (const k of d.remove) el.style[k] = '';
      } else if (name === 'ref') {
        if (typeof oldProps.ref === 'function') oldProps.ref(null);
        if (typeof set.ref === 'function') set.ref(el);
      } else {
        setProp(el, name, set[name]);
      }
    }
    for (const name of remove) {
      stats.propUpdates += 1;
      if (name === 'style') { if (typeof oldProps.style === 'object' && oldProps.style) for (const k of Object.keys(oldProps.style)) el.style[k] = ''; else el.removeAttribute('style'); }
      else if (name === 'ref') { if (typeof oldProps.ref === 'function') oldProps.ref(null); }
      else setProp(el, name, undefined);
    }
  }

  // ---- components ----------------------------------------------------------------------------

  function renderInstance(inst) {
    stats.componentRenders += 1;
    let out = inst.def.render({ props: inst.props, state: inst.state, setState: inst.setState });
    if (out === null || out === undefined || typeof out === 'boolean') out = createTextVNode('');
    else if (typeof out === 'string' || typeof out === 'number') out = createTextVNode(out);
    else if (Array.isArray(out)) throw new TypeError('A component must return a single vnode (wrap siblings in an element)');
    return out;
  }

  function hookContext(inst) {
    return { props: inst.props, state: inst.state, setState: inst.setState, el: inst.vnode ? getEl(inst.vnode) : null };
  }

  function createInstance(vnode) {
    const def = normalizeComponent(vnode.type);
    const inst = { def, props: vnode.props, state: undefined, vnode: null, dirty: false, unmounted: false, depth };
    inst.state = typeof def.state === 'function' ? def.state(inst.props) : def.state;
    inst.setState = (partial) => {
      if (inst.unmounted) return;
      const next = typeof partial === 'function' ? partial(inst.state, inst.props) : partial;
      if (next === null || next === undefined) return;
      const merged = { ...inst.state, ...next };
      if (inst.state && shallowEqual(inst.state, merged)) return;
      inst.state = merged;
      if (!inst.dirty) { inst.dirty = true; dirty.add(inst); scheduleFlush(); }
    };
    return inst;
  }

  function updateInstance(inst) {
    inst.dirty = false;
    dirty.delete(inst);
    const prev = inst.vnode;
    const next = renderInstance(inst);
    depth += 1;
    try { patch(prev, next); } finally { depth -= 1; }
    inst.vnode = next;
    if (inst.def.updated) mountQueue.push(() => inst.def.updated(hookContext(inst)));
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    schedule(flush);
  }

  function runHooks() {
    const queue = mountQueue;
    mountQueue = [];
    for (const hook of queue) hook();
  }

  /** Re-renders every component marked dirty, parents before children. */
  function flush() {
    flushScheduled = false;
    while (dirty.size) {
      const batch = [...dirty].sort((a, b) => a.depth - b.depth);
      dirty.clear();
      for (const inst of batch) if (!inst.unmounted && inst.dirty) updateInstance(inst);
    }
    runHooks();
  }

  // ---- create / patch / unmount --------------------------------------------------------------

  function createNode(vnode) {
    stats.created += 1;
    if (isTextVNode(vnode)) {
      vnode.el = doc.createTextNode(vnode.text);
      return vnode.el;
    }
    if (isComponentVNode(vnode)) {
      const inst = createInstance(vnode);
      vnode.instance = inst;
      inst.vnode = renderInstance(inst);
      depth += 1;
      let el;
      try { el = createNode(inst.vnode); } finally { depth -= 1; }
      if (inst.def.mounted) mountQueue.push(() => { if (!inst.unmounted) inst.def.mounted(hookContext(inst)); });
      return el;
    }
    const el = doc.createElement(vnode.type);
    vnode.el = el;
    applyProps(el, {}, vnode.props);
    for (const child of vnode.children) el.appendChild(createNode(child));
    return el;
  }

  function unmount(vnode) {
    if (isTextVNode(vnode)) return;
    if (isComponentVNode(vnode)) {
      const inst = vnode.instance;
      inst.unmounted = true;
      dirty.delete(inst);
      if (inst.def.unmounted) inst.def.unmounted({ props: inst.props, state: inst.state, setState: inst.setState, el: null });
      unmount(inst.vnode);
      return;
    }
    if (typeof vnode.props.ref === 'function') vnode.props.ref(null);
    for (const child of vnode.children) unmount(child);
  }

  function replace(oldV, newV) {
    const oldEl = getEl(oldV);
    const parent = oldEl.parentNode;
    const newEl = createNode(newV);
    parent.replaceChild(newEl, oldEl);
    stats.removed += 1;
    unmount(oldV);
  }

  function patch(oldV, newV) {
    if (oldV === newV) return;
    if (!isSameVNode(oldV, newV)) { replace(oldV, newV); return; }
    if (isTextVNode(newV)) {
      newV.el = oldV.el;
      if (oldV.text !== newV.text) { newV.el.nodeValue = newV.text; stats.textUpdates += 1; }
      return;
    }
    if (isComponentVNode(newV)) {
      const inst = oldV.instance;
      newV.instance = inst;
      inst.props = newV.props;
      updateInstance(inst);
      return;
    }
    const el = oldV.el;
    newV.el = el;
    applyProps(el, oldV.props, newV.props);
    patchChildren(el, oldV.children, newV.children);
  }

  function patchChildren(parentEl, oldChildren, newChildren) {
    const { matches, removed, stable } = matchChildren(oldChildren, newChildren);

    for (const oi of removed) {
      parentEl.removeChild(getEl(oldChildren[oi]));
      unmount(oldChildren[oi]);
      stats.removed += 1;
    }

    newChildren.forEach((child, i) => {
      if (matches[i] !== -1) patch(oldChildren[matches[i]], child);
      else createNode(child);
    });

    // Walk backwards so every node can be placed before an already-final neighbour.
    for (let i = newChildren.length - 1; i >= 0; i--) {
      const el = getEl(newChildren[i]);
      const anchor = i + 1 < newChildren.length ? getEl(newChildren[i + 1]) : null;
      if (matches[i] === -1) {
        parentEl.insertBefore(el, anchor);
      } else if (!stable.has(i)) {
        parentEl.insertBefore(el, anchor);
        stats.moved += 1;
      }
    }
  }

  // ---- public API ----------------------------------------------------------------------------

  function render(vnode, container) {
    if (typeof vnode === 'string' || typeof vnode === 'number') vnode = createTextVNode(vnode);
    const prev = container.__vroot;
    if (vnode === null || vnode === undefined || vnode === false) {
      if (prev) { container.removeChild(getEl(prev)); unmount(prev); stats.removed += 1; container.__vroot = null; }
      return;
    }
    if (!prev) {
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(createNode(vnode));
    } else {
      patch(prev, vnode);
    }
    container.__vroot = vnode;
    runHooks();
  }

  function resetStats() {
    for (const key of Object.keys(stats)) stats[key] = 0;
  }

  return { render, flush, stats, resetStats };
}

export { TEXT };
