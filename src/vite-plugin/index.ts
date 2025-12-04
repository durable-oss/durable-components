/**
 * Vite Plugin for Durable Components
 *
 * This plugin integrates .dce files into the Vite build pipeline,
 * compiling them to the target framework during development and build.
 */

import type { Plugin, ViteDevServer } from 'vite';
import { compile } from '../index';
import type { CompilerTarget, StyleMode } from '../types/compiler';
import * as path from 'path';
import * as fs from 'fs';

export interface DurableComponentsPluginOptions {
  /**
   * Target framework to compile to
   * @default 'react'
   */
  target?: CompilerTarget;

  /**
   * Style generation mode
   * @default 'scoped'
   */
  style?: StyleMode;

  /**
   * File extensions to process
   * @default ['.dce']
   */
  extensions?: string[];

  /**
   * Enable development mode (more readable output, better errors)
   * @default true in dev, false in build
   */
  dev?: boolean;

  /**
   * Include file patterns (glob)
   * @default undefined (all .dce files)
   */
  include?: string | string[];

  /**
   * Exclude file patterns (glob)
   * @default ['node_modules/**']
   */
  exclude?: string | string[];
}

/**
 * Vite plugin for Durable Components
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { durableComponents } from '@durable/compiler/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     durableComponents({
 *       target: 'react',
 *       style: 'scoped'
 *     })
 *   ]
 * });
 * ```
 */
export function durableComponents(
  options: DurableComponentsPluginOptions = {}
): Plugin {
  const {
    target = 'react',
    style = 'scoped',
    extensions = ['.dce'],
    dev,
    include,
    exclude = ['node_modules/**']
  } = options;

  // Track CSS files generated during compilation
  const cssMap = new Map<string, string>();

  // Track component dependencies for HMR
  const componentDeps = new Map<string, Set<string>>();

  let server: ViteDevServer | undefined;
  let isDev = false;

  return {
    name: 'vite-plugin-durable-components',

    // Run before other plugins that might transform JS
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve' || dev === true;
    },

    configureServer(_server) {
      server = _server;
    },

    resolveId(source, importer) {
      // Handle virtual CSS modules
      if (source.startsWith('dce-css:')) {
        return source;
      }

      // Handle .dce file imports
      if (extensions.some(ext => source.endsWith(ext))) {
        // Resolve relative imports
        if (importer && source.startsWith('.')) {
          const resolved = path.resolve(path.dirname(importer), source);
          return resolved;
        }
      }

      return null;
    },

    load(id) {
      // Serve virtual CSS modules
      if (id.startsWith('dce-css:')) {
        const actualId = id.slice('dce-css:'.length);
        const css = cssMap.get(actualId);

        if (css) {
          return {
            code: css,
            map: null
          };
        }
      }

      return null;
    },

    async transform(code, id) {
      // Only process files with the configured extensions
      const isTargetFile = extensions.some(ext => id.endsWith(ext));

      if (!isTargetFile) {
        return null;
      }

      // Check exclude patterns
      if (exclude) {
        const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
        for (const pattern of excludePatterns) {
          if (minimatch(id, pattern)) {
            return null;
          }
        }
      }

      // Check include patterns
      if (include) {
        const includePatterns = Array.isArray(include) ? include : [include];
        let matched = false;
        for (const pattern of includePatterns) {
          if (minimatch(id, pattern)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          return null;
        }
      }

      try {
        const filename = path.basename(id);

        // Compile the .dce file
        const result = compile(code, {
          filename,
          target,
          style,
          dev: isDev
        });

        let transformedCode = result.js.code;

        // Handle CSS output
        if (result.css && result.css.code) {
          // Store CSS for later retrieval
          cssMap.set(id, result.css.code);

          // Inject CSS import into the component
          // This creates a virtual module that Vite will process
          const cssImport = `import 'dce-css:${id}';\n`;
          transformedCode = cssImport + transformedCode;
        }

        // Track dependencies for HMR
        if (server && isDev) {
          const deps = componentDeps.get(id) || new Set();

          // Add self to deps
          deps.add(id);

          // If there's CSS, track it too
          if (result.css) {
            deps.add(`dce-css:${id}`);
          }

          componentDeps.set(id, deps);
        }

        return {
          code: transformedCode,
          map: null // TODO: Support source maps
        };
      } catch (error) {
        // Format compiler errors nicely
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.error({
          message: `Failed to compile ${path.basename(id)}: ${errorMessage}`,
          id
        });

        return null;
      }
    },

    handleHotUpdate({ file, server: _server }) {
      // Handle HMR for .dce files
      if (extensions.some(ext => file.endsWith(ext))) {
        // Clear CSS cache for this file
        cssMap.delete(file);

        // Get all modules that depend on this component
        const deps = componentDeps.get(file);

        if (deps) {
          const modules = Array.from(deps)
            .map(id => _server.moduleGraph.getModuleById(id))
            .filter((m): m is NonNullable<typeof m> => m !== undefined);

          // Invalidate all dependent modules
          modules.forEach(mod => {
            _server.moduleGraph.invalidateModule(mod);
          });

          return modules;
        }
      }

      return undefined;
    },

    // Clean up on build end
    buildEnd() {
      cssMap.clear();
      componentDeps.clear();
    }
  };
}

/**
 * Simple glob pattern matcher (minimal implementation)
 * For production use, consider using a library like 'micromatch'
 */
function minimatch(file: string, pattern: string): boolean {
  // Simple implementation - converts glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(file);
}

export default durableComponents;
