/**
 * Path Resolution Utilities
 *
 * Handles resolving component import paths to actual file system paths.
 */
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
export declare function resolveComponentPath(source: string, options: ResolveOptions): string | null;
/**
 * Resolves multiple component paths in batch
 *
 * @param sources - Array of import sources
 * @param options - Resolution options
 * @returns Map of source to resolved path (null if not found)
 */
export declare function resolveComponentPaths(sources: string[], options: ResolveOptions): Map<string, string | null>;
/**
 * Extracts the base directory from a file path
 *
 * @param filePath - The file path
 * @returns The directory containing the file
 */
export declare function getBaseDir(filePath: string): string;
/**
 * Normalizes a file path (resolves .., ., and ensures forward slashes on Windows)
 *
 * @param filePath - The file path to normalize
 * @returns The normalized path
 */
export declare function normalizePath(filePath: string): string;
/**
 * Checks if a file path is a DCE component file
 *
 * @param filePath - The file path to check
 * @returns True if the file is a .dce file
 */
export declare function isDCEFile(filePath: string): boolean;
