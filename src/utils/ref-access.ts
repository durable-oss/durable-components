/**
 * Rewrite `bind:this` names to the accessor their framework needs.
 *
 * A ref is a bare identifier in the DSL — `panel.focus()` — but React reaches
 * the element through `panel.current` and Vue through `panel.value`. Script
 * code that touches a ref has to be rewritten, or the emitted component calls
 * a method on the ref container itself and throws.
 *
 * Solid and Svelte assign the element to the variable directly, so they need
 * no rewrite at all.
 */

import type { RefDefinition } from '../types/ir';

/**
 * Rewrite every read of a ref name to go through `accessor`.
 *
 * Reads already carrying the accessor are left alone, as are property names
 * that merely share the spelling: `row.panel` is not the ref.
 */
export function withRefAccess(
  code: string,
  refs: RefDefinition[] | undefined,
  accessor: string
): string {
  return (refs ?? []).reduce(
    (acc, ref) =>
      acc.replace(
        new RegExp(`(?<![.\\w$])${ref.name}\\b(?!\\.${accessor})`, 'g'),
        `${ref.name}.${accessor}`
      ),
    code
  );
}
