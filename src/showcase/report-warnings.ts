/**
 * Print compiler warnings from the showcase server.
 *
 * The server recompiles a component on every file change and on every preview
 * request, so printing unconditionally would repeat the same diagnostic until
 * it is lost in the scrollback. Each distinct warning is reported once per
 * component, and a component's record is cleared when its source changes so a
 * warning that is still there after an edit is shown again.
 */

import type { CompilerWarning } from '../types/compiler';
import { formatWarning } from '../utils/format-warning';

/** Warnings already printed, keyed by component filename. */
const reported = new Map<string, Set<string>>();

export function reportWarnings(
  warnings: CompilerWarning[] | undefined,
  filename: string
): void {
  if (!warnings || warnings.length === 0) return;

  let seen = reported.get(filename);
  if (!seen) {
    seen = new Set<string>();
    reported.set(filename, seen);
  }

  for (const warning of warnings) {
    const line = formatWarning(warning, filename);
    if (seen.has(line)) continue;

    seen.add(line);
    console.warn(`⚠ ${line}`);
  }
}

/**
 * Forget what has been reported for a component, so its warnings print again
 * after the next compile. Called when the file changes.
 */
export function resetReportedWarnings(filename: string): void {
  reported.delete(filename);
}
