/**
 * Durable Component Compiler
 *
 * Public API exports - now using the unified.js collective framework
 */

import { durableComponentProcessor } from './processor';
import { durableParser } from './parser/plugin';
import { durableTreeStorage } from './transformer/plugin';
import { durableScopedStyles } from './styles/scoped-plugin';
import { durableReactCompiler } from './generators/react-plugin';
import { durableSolidCompiler } from './generators/solid-plugin';
import { durableSvelteCompiler } from './generators/svelte-plugin';
import { durableVueCompiler } from './generators/vue-plugin';
import { durableComponentFlattener } from './transformer/flattener-plugin';
import { durableTemplateFlatten } from './transformer/template-flattener-plugin';
import type { CompileOptions, CompileResult, IncludedComponent } from './types/compiler';
import { CompilerError } from './types/compiler';
import type { FlattenResult } from './transformer/component-flattener';
import { generateReact } from './generators/react';
import { generateVue } from './generators/vue';
import { generateSolid } from './generators/solid';
import { generateSvelte } from './generators/svelte';

/**
 * Main compile function
 *
 * Compiles a .dce source file into target framework code.
 * This is the primary API for the @durable/compiler package.
 *
 * Now uses the unified.js collective framework for component tree transformation.
 */
export function compile(source: string, options: CompileOptions): CompileResult {
  // Defensive: validate inputs
  if (typeof source !== 'string') {
    throw new TypeError('compile: source must be a string');
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('compile: options must be an object');
  }
  if (!options.target || typeof options.target !== 'string') {
    throw new CompilerError(
      'compile: options.target is required and must be a string',
      undefined,
      undefined,
      'INVALID_OPTIONS'
    );
  }

  // Defensive: validate target value
  const validTargets = ['react', 'vue', 'solid', 'svelte', 'wc'];
  if (!validTargets.includes(options.target)) {
    throw new CompilerError(
      `Unknown target: ${options.target}. Valid targets are: ${validTargets.join(', ')}`,
      undefined,
      undefined,
      'UNKNOWN_TARGET'
    );
  }

  // Defensive: validate filename if provided
  if (options.filename !== undefined && typeof options.filename !== 'string') {
    throw new TypeError('compile: options.filename must be a string');
  }

  // Defensive: validate style mode if provided
  if (options.style !== undefined) {
    const validStyleModes = ['scoped', 'inline', 'unocss'];
    if (!validStyleModes.includes(options.style)) {
      throw new CompilerError(
        `Invalid style mode: ${options.style}. Valid modes are: ${validStyleModes.join(', ')}`,
        undefined,
        undefined,
        'INVALID_STYLE_MODE'
      );
    }
  }

  try {
    // Build the processor pipeline
    const styleMode = options.style || 'scoped';
    const includeReferencesEnabled = options.includeReferences || false;
    const flattenEnabled = options.flatten || false;

    // Start with parser
    const baseProcessor = durableComponentProcessor()
      .use(durableParser, { filename: options.filename })
      .use(durableTreeStorage); // Store tree in file.data

    // Add template flattener if enabled (must run before styles)
    const templateFlattenedProcessor = flattenEnabled
      ? baseProcessor.use(durableTemplateFlatten, { enabled: true, maxDepth: 10, filename: options.filename })
      : baseProcessor;

    // Add style transformer if needed
    const styledProcessor =
      styleMode === 'scoped' || styleMode === 'inline'
        ? templateFlattenedProcessor.use(durableScopedStyles, { mode: styleMode })
        : templateFlattenedProcessor;

    // Add component reference includer if enabled
    const flattenedProcessor = includeReferencesEnabled
      ? (styledProcessor as any).use(durableComponentFlattener, {
          target: options.target,
          style: styleMode,
          enabled: true,
          maxDepth: options.maxReferenceDepth || 50
        })
      : styledProcessor;

    // Add compiler based on target
    let finalProcessor: any;

    switch (options.target) {
      case 'react':
        finalProcessor = (flattenedProcessor as any).use(durableReactCompiler);
        break;

      case 'vue':
        finalProcessor = (flattenedProcessor as any).use(durableVueCompiler);
        break;

      case 'solid':
        finalProcessor = (flattenedProcessor as any).use(durableSolidCompiler);
        break;

      case 'svelte':
        finalProcessor = (flattenedProcessor as any).use(durableSvelteCompiler);
        break;

      case 'wc':
        throw new CompilerError(
          'Web Component generator not yet implemented',
          undefined,
          undefined,
          'NOT_IMPLEMENTED'
        );

      default:
        throw new CompilerError(
          `Unknown target: ${options.target}`,
          undefined,
          undefined,
          'UNKNOWN_TARGET'
        );
    }

    // Process the source through the unified pipeline
    // Create a VFile with the filename if provided
    const file: any = options.filename
      ? finalProcessor.processSync({ value: source, path: options.filename })
      : finalProcessor.processSync(source);
    // The tree is stored in file.data by the durableTreeStorage plugin
    const tree: any = (file.data as any).tree;
    const flattenResult: FlattenResult | undefined = (file.data as any).flatten;

    // Defensive: validate tree
    if (!tree || typeof tree !== 'object') {
      throw new CompilerError(
        'compile: processor returned invalid tree',
        undefined,
        undefined,
        'INVALID_IR'
      );
    }
    if (typeof tree.name !== 'string') {
      throw new CompilerError(
        'compile: tree missing valid name',
        undefined,
        undefined,
        'INVALID_IR'
      );
    }
    if (!Array.isArray(tree.props)) {
      throw new CompilerError(
        'compile: tree props must be an array',
        undefined,
        undefined,
        'INVALID_IR'
      );
    }

    // The code is already generated by the compiler plugin
    const js = { code: String(file) };

    // Extract CSS from tree data if available
    let css = null;
    if (tree?.data?.scopedCSS) {
      css = tree.data.scopedCSS;
    } else if (tree?.data?.inlineCSS) {
      css = { code: tree.data.inlineCSS };
    }

    // Defensive: validate props for metadata
    const propNames = tree.props.map((p: any) => {
      if (!p || typeof p !== 'object' || typeof p.name !== 'string') {
        return 'unknown';
      }
      return p.name;
    });

    // Compile included components if enabled
    let includedComponents: IncludedComponent[] | undefined;

    if (includeReferencesEnabled && flattenResult) {
      includedComponents = [];

      // Compile each component in dependency order
      for (const componentPath of flattenResult.dependencyOrder) {
        const compiled = flattenResult.components.get(componentPath);
        if (!compiled) continue;

        // Generate code for this component using the appropriate generator
        let componentCode = '';
        let componentCSS: string | null = null;

        switch (options.target) {
          case 'react':
            componentCode = generateReact(compiled.ir).code;
            break;
          case 'vue':
            componentCode = generateVue(compiled.ir).code;
            break;
          case 'solid':
            componentCode = generateSolid(compiled.ir).code;
            break;
          case 'svelte':
            componentCode = generateSvelte(compiled.ir).code;
            break;
          default:
            continue; // Skip if target not supported
        }

        // Extract CSS if available
        if (compiled.ir.styles && compiled.ir.styles.trim()) {
          // Apply scoped styles if needed
          if (styleMode === 'scoped') {
            // For now, just use the raw styles
            // TODO: Apply scoping logic
            componentCSS = compiled.ir.styles;
          } else if (styleMode === 'inline') {
            componentCSS = compiled.ir.styles;
          }
        }

        includedComponents.push({
          path: componentPath,
          name: compiled.ir.name,
          js: { code: componentCode },
          css: componentCSS ? { code: componentCSS } : null
        });
      }
    }

    const result: CompileResult = {
      js,
      css,
      meta: {
        name: tree.name,
        props: propNames
      }
    };

    if (includedComponents) {
      result.components = includedComponents;
    }

    return result;
  } catch (error) {
    if (error instanceof CompilerError) {
      throw error;
    }

    // Defensive: handle various error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Compilation failed: ${errorMessage}`,
      undefined,
      undefined,
      'COMPILATION_ERROR'
    );
  }
}

/**
 * Export types for consumers
 */
export type {
  CompileOptions,
  CompileResult,
  IncludedComponent,
  ParseOptions,
  CompilerTarget,
  StyleMode
} from './types/compiler';

export type { DurableComponentIR } from './types/ir';

/**
 * Export unified.js plugins for advanced usage
 */
export { durableComponentProcessor } from './processor';
export { durableParser } from './parser/plugin';
export { durableTreeStorage } from './transformer/plugin';
export { durableScopedStyles } from './styles/scoped-plugin';
export { durableComponentFlattener } from './transformer/flattener-plugin';
export { durableTemplateFlatten } from './transformer/template-flattener-plugin';
export { durableReactCompiler } from './generators/react-plugin';
export { durableSolidCompiler } from './generators/solid-plugin';
export { durableSvelteCompiler } from './generators/svelte-plugin';
export { durableVueCompiler } from './generators/vue-plugin';

/**
 * Export legacy APIs for backward compatibility
 */
export { parse } from './parser';
export { transform } from './transformer';
export { CompilerError } from './types/compiler';
