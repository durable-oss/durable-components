/**
 * Reconcile `bind:this` refs against declared state.
 *
 * `bind:this={panel}` declares `panel` as an element reference on its own. A
 * component that also writes `let panel = $state(null)` names the same binding
 * twice, and every target then emits two declarations of it in one scope — a
 * syntax error, not just a style problem:
 *
 *     const [panel, setPanel] = useState(null);
 *     const panel = useRef(null);
 *
 * The ref is what the template actually uses, so it wins and the redundant
 * state declaration is dropped. A warning says so, since the discarded
 * initializer is the author's, not the compiler's, to throw away silently.
 */

import type { IRWarning, RefDefinition, StateDefinition } from '../types/ir';

export interface ReconciledRefs {
  state: StateDefinition[];
  refs: RefDefinition[];
  warnings: IRWarning[];
}

/**
 * Warn about a `bind:this` used inside an `{#each}`.
 *
 * One name cannot hold every element the loop renders. Each target degrades
 * differently — the last element on React, Solid, and Svelte; an array on Vue,
 * whose `ref` inside `v-for` collects them — so the compiler says what is
 * happening rather than silently blessing one of those readings.
 */
export function warnRefsBoundInLoop(inLoop: Set<string>): IRWarning[] {
  return Array.from(inLoop).map((name) => ({
    code: 'REF_BOUND_IN_LOOP',
    message:
      `"${name}" is bound with bind:this inside an {#each}, so every ` +
      `iteration writes the same variable and only one element survives ` +
      `(Vue collects them into an array instead). Move the element and its ` +
      `reference into a child component so each item gets its own.`
  }));
}

export function reconcileRefsWithState(
  state: StateDefinition[],
  refs: RefDefinition[]
): ReconciledRefs {
  const refNames = new Set(refs.map((ref) => ref.name));
  const shadowed = state.filter((entry) => refNames.has(entry.name));

  if (shadowed.length === 0) {
    return { state, refs, warnings: [] };
  }

  return {
    state: state.filter((entry) => !refNames.has(entry.name)),
    refs,
    warnings: shadowed.map((entry) => ({
      code: 'REF_SHADOWS_STATE',
      message:
        `"${entry.name}" is declared with $state and also bound with ` +
        `bind:this. bind:this declares the reference itself, so the $state ` +
        `declaration is redundant and has been dropped — remove it, or bind ` +
        `to a different name if the state was meant to be separate.`
    }))
  };
}
