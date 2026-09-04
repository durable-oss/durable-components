/**
 * Comment- and string-aware splitting for the scoped-CSS transformer.
 *
 * The scoper used to split on raw characters, so a comma inside a comment
 * (`/* a comment, with a comma *\/`) was read as a selector separator: the
 * scope attribute was injected into the comment text and the rule that
 * followed was swallowed into it. Everything here skips comments and quoted
 * strings before looking at a delimiter.
 */

/** A top-level chunk of a stylesheet: one rule, or a run of comments/whitespace. */
export interface CssChunk {
  /** The chunk text, trimmed. */
  text: string;
  /** True when the chunk is only comments and whitespace, so it is passed through. */
  isTrivia: boolean;
}

/**
 * Advance past a comment or a quoted string starting at `index`, returning the
 * index just after it. Returns `index` unchanged when nothing special starts
 * there, so callers can use it unconditionally.
 */
export function skipCommentOrString(css: string, index: number): number {
  if (css.startsWith('/*', index)) {
    const end = css.indexOf('*/', index + 2);
    return end === -1 ? css.length : end + 2;
  }

  const quote = css[index];
  if (quote !== '"' && quote !== "'") return index;

  for (let i = index + 1; i < css.length; i++) {
    if (css[i] === '\\') {
      i++;
      continue;
    }
    if (css[i] === quote) return i + 1;
  }

  return css.length;
}

/**
 * Split a stylesheet into top-level chunks at brace depth zero. Comments that
 * sit between rules become trivia chunks so they survive untouched instead of
 * being glued to the next selector.
 */
export function splitRules(css: string): CssChunk[] {
  const chunks: CssChunk[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  /** Flush `current` as a chunk, classifying it as trivia when it has no rule. */
  const flush = () => {
    if (!current.trim()) {
      current = '';
      return;
    }
    chunks.push({ text: current.trim(), isTrivia: !current.includes('{') });
    current = '';
  };

  while (i < css.length) {
    const skipped = skipCommentOrString(css, i);
    if (skipped !== i) {
      const span = css.slice(i, skipped);
      // A comment between rules is its own chunk; inside a rule it stays put.
      if (depth === 0 && span.startsWith('/*') && !current.includes('{')) {
        flush();
        chunks.push({ text: span.trim(), isTrivia: true });
      } else {
        current += span;
      }
      i = skipped;
      continue;
    }

    const char = css[i];
    current += char;
    i++;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth <= 0) {
        depth = 0;
        flush();
      }
    }
  }

  flush();
  return chunks;
}

/**
 * Split a selector list on top-level commas, ignoring commas inside comments,
 * strings, and the parentheses of `:is()`, `:where()`, `:not()`, and friends.
 */
export function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parens = 0;
  let brackets = 0;
  let i = 0;

  while (i < selector.length) {
    const skipped = skipCommentOrString(selector, i);
    if (skipped !== i) {
      current += selector.slice(i, skipped);
      i = skipped;
      continue;
    }

    const char = selector[i];
    i++;

    if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    else if (char === ',' && parens === 0 && brackets === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}
