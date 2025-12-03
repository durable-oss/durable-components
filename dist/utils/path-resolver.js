"use strict";
/**
 * Path Resolution Utilities
 *
 * Handles resolving component import paths to actual file system paths.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveComponentPath = resolveComponentPath;
exports.resolveComponentPaths = resolveComponentPaths;
exports.getBaseDir = getBaseDir;
exports.normalizePath = normalizePath;
exports.isDCEFile = isDCEFile;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
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
function resolveComponentPath(source, options) {
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
function resolveComponentPaths(sources, options) {
    const resolved = new Map();
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
function getBaseDir(filePath) {
    return path.dirname(filePath);
}
/**
 * Normalizes a file path (resolves .., ., and ensures forward slashes on Windows)
 *
 * @param filePath - The file path to normalize
 * @returns The normalized path
 */
function normalizePath(filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
}
/**
 * Checks if a file path is a DCE component file
 *
 * @param filePath - The file path to check
 * @returns True if the file is a .dce file
 */
function isDCEFile(filePath) {
    return path.extname(filePath) === '.dce';
}
