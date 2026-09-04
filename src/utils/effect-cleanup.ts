/**
 * Detecting a teardown returned from an effect.
 *
 * `$effect(() => { ...; return () => cleanup(); })` is the DSL's way to spell
 * "undo this on unmount". React and Svelte honour a returned function
 * natively; Solid and Vue silently discard it and need the teardown handed to
 * `onCleanup` instead, so those generators have to know whether one is there.
 */

/**
 * True when an effect body returns a teardown function.
 *
 * This looks for a `return` at the body's own statement level — a `return`
 * nested inside a callback the effect registers belongs to that callback, not
 * to the effect.
 */
export function returnsTeardown(expression: string): boolean {
  if (typeof expression !== 'string') return false;

  let depth = 0;
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    // Skip strings and template literals so their contents are never scanned.
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      i++;
      while (i < expression.length) {
        if (expression[i] === '\\') {
          i += 2;
          continue;
        }
        if (expression[i] === quote) break;
        i++;
      }
      i++;
      continue;
    }

    if (char === '{' || char === '(') {
      depth++;
      i++;
      continue;
    }

    if (char === '}' || char === ')') {
      depth--;
      i++;
      continue;
    }

    // The effect body is itself wrapped in one set of braces, so its own
    // statements sit at depth 1.
    if (depth === 1 && /\breturn\b/.test(expression.slice(i, i + 6))) {
      const before = i === 0 ? '' : expression[i - 1];
      if (!/[\w$]/.test(before)) return true;
    }

    i++;
  }

  return false;
}
