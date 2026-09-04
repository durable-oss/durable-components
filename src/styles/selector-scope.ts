/**
 * Placing the scope attribute on a selector.
 *
 * The scope attribute belongs on the FIRST compound selector, not the last.
 * Appending it to the whole selector string put it on the trailing compound:
 *
 *   .root :where(td)  ->  .root [data-dce-x]:where(td)   // wrong
 *   .root .child      ->  .root .child[data-dce-x]       // wrong
 *
 * Both require the descendant to carry the attribute, which slotted content
 * never does. Scoping the first compound instead matches the component's own
 * root and lets anything beneath it — slotted or not — be selected normally.
 */

import { skipCommentOrString } from './css-split';

/** Combinators that end a compound selector. */
const COMBINATORS = new Set(['>', '+', '~']);

/**
 * Find the end index of the first compound selector in `selector`.
 *
 * A compound ends at the first top-level combinator (descendant whitespace,
 * `>`, `+`, `~`). Parentheses and brackets are tracked so `:where(a, b)` and
 * `[href^=" "]` do not terminate it early.
 */
export function firstCompoundEnd(selector: string): number {
  let parens = 0;
  let brackets = 0;
  let i = 0;

  // Leading combinator (`> .child` inside a nesting context) has no compound
  // before it, so scope the compound that follows.
  while (i < selector.length && /\s/.test(selector[i])) i++;
  if (COMBINATORS.has(selector[i])) i++;

  for (; i < selector.length; i++) {
    const skipped = skipCommentOrString(selector, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }

    const char = selector[i];

    if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    else if (parens === 0 && brackets === 0) {
      if (/\s/.test(char) || COMBINATORS.has(char)) return i;
    }
  }

  return selector.length;
}

/**
 * Within a compound, find where the scope attribute should be inserted:
 * before any pseudo-class or pseudo-element, so `button:hover` becomes
 * `button[data-x]:hover` rather than `button:hover[data-x]`.
 *
 * A pseudo-class taking a selector argument (`:where(...)`) is treated the
 * same way — the attribute goes in front of it.
 */
export function scopeInsertionPoint(compound: string): number {
  let parens = 0;
  let brackets = 0;

  for (let i = 0; i < compound.length; i++) {
    const skipped = skipCommentOrString(compound, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }

    const char = compound[i];

    if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    else if (char === ':' && parens === 0 && brackets === 0) {
      return i;
    }
  }

  return compound.length;
}

/**
 * Insert the scope attribute into a single selector, on its first compound.
 *
 * A selector whose first compound is only a pseudo-class with no element part
 * (`:where(td)`, `:hover`) gets the attribute in front of it, which is the
 * same position an implicit `*` would occupy.
 */
export function scopeSelector(selector: string, attribute: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;

  // `:root`, `:global(...)`, `from`/`to` and the like are left alone; so is
  // anything that is not really a selector.
  if (trimmed.startsWith(':global')) return trimmed;

  const compoundEnd = firstCompoundEnd(trimmed);
  const compound = trimmed.slice(0, compoundEnd);
  const rest = trimmed.slice(compoundEnd);

  const insertAt = scopeInsertionPoint(compound);

  return `${compound.slice(0, insertAt)}${attribute}${compound.slice(insertAt)}${rest}`;
}
