/**
 * Stateful component definition.
 *
 *   const Counter = defineComponent({
 *     state: (props) => ({ n: props.start ?? 0 }),
 *     render({ props, state, setState }) { return h('button', { onClick: () => setState((s) => ({ n: s.n + 1 })) }, state.n); },
 *     mounted(ctx) {}, updated(ctx) {}, unmounted(ctx) {},
 *   });
 *
 * Plain functions `(props) => vnode` are stateless components and need no definition.
 */
export function defineComponent(definition) {
  if (typeof definition.render !== 'function') throw new TypeError('defineComponent needs a render function');
  return { __component: true, name: definition.name ?? 'Component', ...definition };
}

export function normalizeComponent(type) {
  if (type && type.__component) return type;
  return { __component: true, name: type.name || 'Anonymous', render: ({ props }) => type(props) };
}
