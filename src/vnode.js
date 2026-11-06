/**
 * Virtual nodes.
 *   element:   { type: 'div', props, children, key }
 *   text:      { type: '#text', text, props: {}, children: [], key: null }
 *   component: { type: Function | ComponentDefinition, props: { ...props, children }, children: [], key }
 * A vnode object must appear at most once in a tree: the renderer stores DOM references on it.
 */

export const TEXT = '#text';

export function createTextVNode(text) {
  return { type: TEXT, text: String(text), props: {}, children: [], key: null };
}

/** Flattens nested arrays and turns strings and numbers into text vnodes; null, undefined and booleans vanish. */
export function normalizeChildren(children) {
  const out = [];
  const visit = (child) => {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child === null || child === undefined || typeof child === 'boolean') return;
    else if (typeof child === 'object') out.push(child);
    else out.push(createTextVNode(child));
  };
  visit(children);
  return out;
}

export function h(type, props, ...children) {
  const { key = null, ...rest } = props ?? {};
  const kids = normalizeChildren(children);
  if (typeof type === 'string') return { type, props: rest, children: kids, key };
  if (typeof type === 'function' || (type && type.__component)) {
    return { type, props: { ...rest, children: kids }, children: [], key };
  }
  throw new TypeError('h() expects a tag name, a function component or a component definition');
}

export const isTextVNode = (v) => v.type === TEXT;
export const isComponentVNode = (v) => typeof v.type !== 'string';
