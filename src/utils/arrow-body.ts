/**
 * Arrow function body helpers.
 *
 * An expression used as a concise arrow body must be parenthesized when it
 * starts with `{`, or the brace is parsed as a block statement:
 *
 *   $derived({ a: 1 })  ->  useMemo(() => { a: 1 }, [])   // SyntaxError / undefined
 *   $derived({ a: 1 })  ->  useMemo(() => ({ a: 1 }), []) // correct
 */

/**
 * Wrap an expression in parentheses if it would otherwise be parsed as a block
 * when placed directly after `=>`. Only a leading `{` is ambiguous; every other
 * expression form is returned unchanged.
 */
export function arrowBody(expression: string): string {
  const trimmed = expression.trim();

  if (!trimmed.startsWith('{')) {
    return expression;
  }

  return `(${trimmed})`;
}
