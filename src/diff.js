import { longestIncreasingSubsequence } from './lis.js';

/** Two vnodes can reuse the same DOM node when type and key agree. */
export function isSameVNode(a, b) {
  return a.type === b.type && a.key === b.key;
}

/**
 * Pairs new children with old ones.
 *  - keyed children match by key (and type);
 *  - unkeyed children match by order among unkeyed siblings (and type).
 * Returns { matches, removed, stable }:
 *  matches[i] = index in `oldChildren` that new child i reuses, or -1 when it must be created;
 *  removed    = indexes of old children that disappear;
 *  stable     = Set of new indexes whose DOM nodes are already in the right relative order
 *               (everything else must be moved or inserted).
 */
export function matchChildren(oldChildren, newChildren) {
  const keyedOld = new Map();
  const unkeyedOld = [];
  oldChildren.forEach((child, i) => {
    if (child.key !== null && child.key !== undefined) {
      if (!keyedOld.has(child.key)) keyedOld.set(child.key, i); // a duplicate key is treated as a new node
    } else {
      unkeyedOld.push(i);
    }
  });

  const used = new Set();
  let unkeyedCursor = 0;
  const matches = newChildren.map((child) => {
    let oldIndex = -1;
    if (child.key !== null && child.key !== undefined) {
      const candidate = keyedOld.get(child.key);
      if (candidate !== undefined && !used.has(candidate) && oldChildren[candidate].type === child.type) oldIndex = candidate;
    } else {
      const candidate = unkeyedOld[unkeyedCursor++];
      if (candidate !== undefined && oldChildren[candidate].type === child.type) oldIndex = candidate;
    }
    if (oldIndex !== -1) used.add(oldIndex);
    return oldIndex;
  });

  const removed = [];
  for (let i = 0; i < oldChildren.length; i++) if (!used.has(i)) removed.push(i);

  const stable = new Set(longestIncreasingSubsequence(matches));
  return { matches, removed, stable };
}

/** Which props to set (new or changed) and which to remove. Handlers compare by reference. */
export function diffProps(oldProps, newProps) {
  const set = {};
  const remove = [];
  for (const key of Object.keys(newProps)) {
    if (key === 'children') continue;
    if (!(key in oldProps) || !Object.is(oldProps[key], newProps[key])) set[key] = newProps[key];
  }
  for (const key of Object.keys(oldProps)) {
    if (key !== 'children' && !(key in newProps)) remove.push(key);
  }
  return { set, remove };
}

export function diffStyle(oldStyle = {}, newStyle = {}) {
  const set = {};
  const remove = [];
  for (const key of Object.keys(newStyle)) if (oldStyle[key] !== newStyle[key]) set[key] = newStyle[key];
  for (const key of Object.keys(oldStyle)) if (!(key in newStyle)) remove.push(key);
  return { set, remove };
}
