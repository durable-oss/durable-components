/**
 * Code generation utilities
 */

/**
 * Indent code block
 */
export function indent(code: string, level: number = 1, char: string = '  '): string {
  const indentation = char.repeat(level);
  return code
    .split('\n')
    .map((line) => (line.trim() ? indentation + line : line))
    .join('\n');
}

/**
 * Dedent code (remove common leading whitespace)
 */
export function dedent(code: string): string {
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length === 0) return '';

  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => line.match(/^\s*/)?.[0].length || 0)
  );

  return lines.map((line) => line.slice(minIndent)).join('\n');
}

/**
 * Join code statements with proper spacing
 */
export function joinStatements(...statements: (string | null | undefined)[]): string {
  return statements.filter(Boolean).join('\n\n');
}

/**
 * Wrap code in a block
 */
export function block(code: string): string {
  return `{\n${indent(code)}\n}`;
}

/**
 * Create an array literal
 */
export function arrayLiteral(items: string[]): string {
  if (items.length === 0) return '[]';
  if (items.length === 1) return `[${items[0]}]`;
  return `[\n${indent(items.join(',\n'))}\n]`;
}

/**
 * Create an object literal
 */
export function objectLiteral(props: Record<string, string>): string {
  const entries = Object.entries(props);
  if (entries.length === 0) return '{}';
  if (entries.length === 1) {
    const [key, value] = entries[0];
    return `{ ${key}: ${value} }`;
  }
  const lines = entries.map(([key, value]) => `${key}: ${value}`);
  return `{\n${indent(lines.join(',\n'))}\n}`;
}
