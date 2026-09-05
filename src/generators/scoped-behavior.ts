/**
 * Per-item emission for behavior primitives captured inside an `{#each}`.
 *
 * A primitive that reads a loop binding cannot compile to a component-level
 * effect: the binding does not exist there. Every target instead gets a small
 * generated component rendered once per iteration, which receives the loop
 * variable as a prop and owns the effect for that item's lifetime — so the
 * effect also tears down when that one item leaves the list, not only when the
 * whole component unmounts.
 */

import type { DurableComponentIR, LifecycleEffect, LifecycleScope } from '../types/ir';

/** A scoped effect paired with the props its generated component takes. */
export interface ScopedBehavior {
  scope: LifecycleScope;
  effect: LifecycleEffect;
  /** Every prop the component needs, loop bindings first. */
  props: string[];
}

/** The generated component's name, e.g. `Toast__timer_0`. */
export function scopedComponentName(componentName: string, scope: LifecycleScope): string {
  return `${componentName}__${scope.id}`;
}

/** Split component-level effects from the per-item ones. */
export function partitionLifecycle(ir: DurableComponentIR): {
  componentLevel: LifecycleEffect[];
  scoped: ScopedBehavior[];
} {
  const componentLevel: LifecycleEffect[] = [];
  const scoped: ScopedBehavior[] = [];

  for (const effect of ir.lifecycle ?? []) {
    if (effect.scope) {
      scoped.push({
        scope: effect.scope,
        effect,
        props: [...effect.scope.params, ...effect.scope.captures]
      });
    } else {
      componentLevel.push(effect);
    }
  }

  return { componentLevel, scoped };
}

/** Find the scoped effect a `dce-behavior` placeholder stands for. */
export function scopedFor(
  scoped: ScopedBehavior[],
  scope: LifecycleScope | undefined
): ScopedBehavior | undefined {
  if (!scope) return undefined;
  return scoped.find((entry) => entry.scope.id === scope.id);
}
