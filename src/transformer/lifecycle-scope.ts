/**
 * Loop scope tracking for the `dce:*` behavior primitives.
 *
 * A behavior primitive normally compiles to one component-level mount/unmount
 * effect. Inside an `{#each}` that is wrong: the effect belongs to a single
 * iteration, and hoisting it to component scope leaves the loop variable
 * undefined at runtime. These helpers work out whether a given effect reads
 * the loop scope, and describe what a per-item component needs to receive.
 */

import type { LifecycleEffect, LifecycleScope } from '../types/ir';

/** A single `{#each}` frame: the identifiers it binds. */
export interface LoopFrame {
  /** The item binding, e.g. `item` in `{#each items as item}`. */
  itemName: string;
  /** The index binding, when the loop declares one. */
  indexName?: string;
}

/**
 * Identifiers read by an effect's setup and teardown code.
 *
 * The emitted code is a call expression built from template attributes rather
 * than arbitrary user source, so a word-boundary scan is enough here: there
 * are no string literals or comments to skip past, and no shadowing to track.
 */
export function identifiersIn(effect: LifecycleEffect): Set<string> {
  const code = `${effect.setup};${effect.teardown ?? ''}`;
  const found = new Set<string>();

  // Match identifiers, but not the property half of a member expression —
  // `item.duration` reads `item`, and `duration` is not a binding.
  const pattern = /(\.)?\b([A-Za-z_$][\w$]*)\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    if (match[1]) continue;
    found.add(match[2]);
  }

  return found;
}

/**
 * Describe the loop scope an effect captures, or `undefined` when it captures
 * none. A primitive that happens to sit inside a loop without reading the loop
 * variable — `<dce:scroll-lock />`, say — keeps its component-level effect,
 * which is both correct and cheaper than one effect per item.
 */
export function scopeFor(
  effect: LifecycleEffect,
  frames: LoopFrame[],
  id: string
): LifecycleScope | undefined {
  if (frames.length === 0) return undefined;

  const read = identifiersIn(effect);
  const bound: string[] = [];

  for (const frame of frames) {
    if (read.has(frame.itemName)) bound.push(frame.itemName);
    if (frame.indexName && read.has(frame.indexName)) bound.push(frame.indexName);
  }

  if (bound.length === 0) return undefined;

  // Anything else the effect reads still comes from component scope, so the
  // per-item component has to receive it as a prop too.
  const loopNames = new Set(
    frames.flatMap((frame) =>
      frame.indexName ? [frame.itemName, frame.indexName] : [frame.itemName]
    )
  );
  const captures = Array.from(read).filter(
    (name) => !loopNames.has(name) && !isGlobal(name)
  );

  return { id, params: bound, captures };
}

/**
 * Names that resolve without being passed in: the emitted behavior helpers and
 * the browser globals they are built on.
 */
const GLOBALS = new Set([
  'window',
  'document',
  'undefined',
  'null',
  'true',
  'false'
]);

function isGlobal(name: string): boolean {
  return GLOBALS.has(name) || name.startsWith('__dce');
}
