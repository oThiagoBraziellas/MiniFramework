/** A tiny DOM double: just enough surface for the renderer, plus serialisation and operation counters. */

class FakeNode {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() { return this.childNodes[0] ?? null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  detach() {
    if (this.parentNode) {
      const siblings = this.parentNode.childNodes;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentNode = null;
    }
  }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, ref) {
    node.detach();
    const index = ref === null || ref === undefined ? this.childNodes.length : this.childNodes.indexOf(ref);
    if (index === -1) throw new Error('insertBefore: reference node is not a child');
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    this.doc.ops.dom += 1;
    return node;
  }
  removeChild(node) {
    if (node.parentNode !== this) throw new Error('removeChild: not a child');
    node.detach();
    this.doc.ops.dom += 1;
    return node;
  }
  replaceChild(next, old) {
    if (old.parentNode !== this) throw new Error('replaceChild: not a child');
    const index = this.childNodes.indexOf(old);
    next.detach();
    this.childNodes.splice(this.childNodes.indexOf(old), 1, next);
    old.parentNode = null;
    next.parentNode = this;
    this.doc.ops.dom += 1;
    void index;
    return old;
  }
}

export class FakeText extends FakeNode {
  constructor(doc, text) { super(); this.doc = doc; this.nodeType = 3; this.nodeValue = text; }
}

export class FakeElement extends FakeNode {
  constructor(doc, tagName) {
    super();
    this.doc = doc;
    this.nodeType = 1;
    this.tagName = tagName;
    this.attributes = new Map();
    this.style = {};
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(type, event = {}) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn({ type, target: this, ...event });
  }
  listenerCount(type) { return this.listeners.get(type)?.size ?? 0; }
}

export class FakeDocument {
  constructor() { this.ops = { dom: 0 }; }
  createElement(tag) { return new FakeElement(this, tag); }
  createTextNode(text) { return new FakeText(this, text); }
  createContainer() { return this.createElement('root'); }
}

/** Serialises a node to compact HTML, attributes sorted, so tests can compare strings. */
export function html(node) {
  if (node.nodeType === 3) return node.nodeValue;
  const attrs = [...node.attributes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`)).join('');
  const style = Object.entries(node.style).filter(([, v]) => v !== '').map(([k, v]) => `${k}:${v}`).join(';');
  const styleAttr = style ? ` style="${style}"` : '';
  return `<${node.tagName}${attrs}${styleAttr}>${node.childNodes.map(html).join('')}</${node.tagName}>`;
}

export function inner(container) {
  return container.childNodes.map(html).join('');
}
