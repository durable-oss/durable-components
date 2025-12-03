/**
 * Path Resolution Utilities
 *
 * Handles resolving component import paths to actual file system paths.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Options for resolving component paths
 */
export interface ResolveOptions {
  /** The base directory to resolve relative to (usually the directory of the importing file) */
  baseDir: string;
  /** File extensions to try when resolving (in order of preference) */
  extensions?: string[];
  /** Whether to check if the file exists before returning */
  checkExists?: boolean;
}

/**
 * Resolves a component import source to an absolute file path
 *
 * @param source - The import source (e.g., './Button', '../Counter.dce')
 * @param options - Resolution options
 * @returns The resolved absolute path, or null if not found
 *
 * @example
 * ```ts
 * // Resolve './Button' from /src/components/App.dce
 * const resolved = resolveComponentPath('./Button', {
 *   baseDir: '/src/components',
 *   extensions: ['.dce'],
 *   checkExists: true
 * });
 * // Returns: '/src/components/Button.dce' (if it exists)
 * ```
 */
export function resolveComponentPath(
  source: string,
  options: ResolveOptions
): string | null {
  const { baseDir, extensions = ['.dce', '.ts', '.js'], checkExists = true } = options;

  // If source is already absolute, return it
  if (path.isAbsolute(source)) {
    return checkExists && fs.existsSync(source) ? source : null;
  }

  // Resolve relative to base directory
  const basePath = path.resolve(baseDir, source);

  // If source already has an extension, try it first
  if (path.extname(source)) {
    if (!checkExists || fs.existsSync(basePath)) {
      return basePath;
    }
    return null;
  }

  // Try each extension
  for (const ext of extensions) {
    const pathWithExt = basePath + ext;
    if (!checkExists || fs.existsSync(pathWithExt)) {
      return pathWithExt;
    }
  }

  // Try index files in directory
  for (const ext of extensions) {
    const indexPath = path.join(basePath, `index${ext}`);
    if (!checkExists || fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

/**
 * Resolves multiple component paths in batch
 *
 * @param sources - Array of import sources
 * @param options - Resolution options
 * @returns Map of source to resolved path (null if not found)
 */
export function resolveComponentPaths(
  sources: string[],
  options: ResolveOptions
): Map<string, string | null> {
  const resolved = new Map<string, string | null>();

  for (const source of sources) {
    resolved.set(source, resolveComponentPath(source, options));
  }

  return resolved;
}

/**
 * Extracts the base directory from a file path
 *
 * @param filePath - The file path
 * @returns The directory containing the file
 */
export function getBaseDir(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Normalizes a file path (resolves .., ., and ensures forward slashes on Windows)
 *
 * @param filePath - The file path to normalize
 * @returns The normalized path
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * Checks if a file path is a DCE component file
 *
 * @param filePath - The file path to check
 * @returns True if the file is a .dce file
 */
export function isDCEFile(filePath: string): boolean {
  return path.extname(filePath) === '.dce';
}
