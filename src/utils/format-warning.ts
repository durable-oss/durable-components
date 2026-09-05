/**
 * Render a compiler warning for a human reader.
 *
 * Warnings reach callers on `compile()`'s result rather than as thrown errors,
 * so every entry point has to print them itself. Sharing the formatting keeps
 * the CLI and the Vite plugin phrasing a given diagnostic the same way.
 */

import type { CompilerWarning } from '../types/compiler';

/**
 * One warning as a single line: where it came from, then what is wrong.
 *
 * The location is included only when the warning carries one, since most
 * diagnostics are about a declaration rather than a span of source.
 */
export function formatWarning(warning: CompilerWarning, filename?: string): string {
  const where = [filename, warning.start ? `${warning.start.line}:${warning.start.column}` : null]
    .filter(Boolean)
    .join(':');

  const code = warning.code ? ` [${warning.code}]` : '';

  return where
    ? `${where}${code} ${warning.message}`
    : `${code.trim()} ${warning.message}`.trim();
}

/**
 * All of a compile's warnings, one per line, or an empty string when there are
 * none — so a caller can print the result unconditionally.
 */
export function formatWarnings(
  warnings: CompilerWarning[] | undefined,
  filename?: string
): string {
  if (!warnings || warnings.length === 0) return '';

  return warnings.map((warning) => formatWarning(warning, filename)).join('\n');
}
