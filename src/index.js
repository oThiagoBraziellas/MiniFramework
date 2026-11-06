import { createRenderer } from './renderer.js';

export { h } from './vnode.js';
export { defineComponent } from './component.js';
export { createRenderer } from './renderer.js';
export { matchChildren, diffProps } from './diff.js';
export { longestIncreasingSubsequence } from './lis.js';

let defaultRenderer = null;

/** Renders into a container using the global `document`. Calling it again patches instead of rebuilding. */
export function render(vnode, container) {
  defaultRenderer ??= createRenderer();
  defaultRenderer.render(vnode, container);
  return defaultRenderer;
}
