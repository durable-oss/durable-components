/**
 * Component Reference Flattener
 *
 * Recursively compiles all DCE components referenced by a component,
 * producing a flat output of all required components.
 */

import type { DurableComponentIR } from '../types/ir';
import type { CompilerTarget, StyleMode } from '../types/compiler';
import { analyzeComponentReferences, filterDCEComponents, type ComponentReference } from './component-analyzer';
import { resolveComponentPath, getBaseDir } from '../utils/path-resolver';
import { parse } from '../parser';
import { transform } from './index';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a compiled component with metadata
 */
export interface CompiledComponent {
  /** The source file path of this component */
  sourcePath: string;
  /** The component's intermediate representation */
  ir: DurableComponentIR;
  /** Component references found in this component */
  references: ComponentReference[];
}

/**
 * Options for flattening component references
 */
export interface FlattenOptions {
  /** The target framework */
  target: CompilerTarget;
  /** Style generation mode */
  style?: StyleMode;
  /** The source file path (for resolving relative imports) */
  sourcePath?: string;
  /** Base directory for resolving imports (defaults to sourcePath's directory) */
  baseDir?: string;
  /** Maximum recursion depth to prevent infinite loops */
  maxDepth?: number;
}

/**
 * Result of flattening component references
 */
export interface FlattenResult {
  /** Map of source paths to compiled components */
  components: Map<string, CompiledComponent>;
  /** Array of source paths in dependency order (leaves first) */
  dependencyOrder: string[];
}

/**
 * Flattens all DCE component references recursively
 *
 * This function analyzes a component's IR, finds all referenced DCE components,
 * resolves their file paths, parses and analyzes them, and recursively processes
 * their dependencies.
 *
 * @param ir - The root component's intermediate representation
 * @param options - Flattening options
 * @returns Flattening result with all components and dependency order
 */
export function flattenComponentReferences(
  ir: DurableComponentIR,
  options: FlattenOptions
): FlattenResult {
  const {
    sourcePath,
    baseDir = sourcePath ? getBaseDir(sourcePath) : process.cwd(),
    maxDepth = 50
  } = options;

  const components = new Map<string, CompiledComponent>();
  const visited = new Set<string>();
  const dependencyOrder: string[] = [];

  /**
   * Recursively process a component and its dependencies
   */
  function processComponent(
    componentIR: DurableComponentIR,
    componentPath: string | null,
    depth: number
  ): void {
    // Check depth limit to prevent infinite recursion
    if (depth > maxDepth) {
      console.warn(`Maximum recursion depth (${maxDepth}) reached for component ${componentIR.name}`);
      return;
    }

    // If we don't have a path, we can't resolve dependencies
    if (!componentPath) {
      return;
    }

    // Normalize the path
    const normalizedPath = path.resolve(componentPath);

    // Skip if already visited
    if (visited.has(normalizedPath)) {
      return;
    }

    visited.add(normalizedPath);

    // Analyze component references
    const allReferences = analyzeComponentReferences(componentIR);
    const dceReferences = filterDCEComponents(allReferences);

    // Store this component
    const compiled: CompiledComponent = {
      sourcePath: normalizedPath,
      ir: componentIR,
      references: dceReferences
    };

    components.set(normalizedPath, compiled);

    // Resolve and process each DCE component reference
    const componentBaseDir = getBaseDir(normalizedPath);

    for (const reference of dceReferences) {
      const resolvedPath = resolveComponentPath(reference.source, {
        baseDir: componentBaseDir,
        extensions: ['.dce'],
        checkExists: true
      });

      if (!resolvedPath) {
        console.warn(
          `Could not resolve component '${reference.name}' from '${reference.source}' in ${componentIR.name}`
        );
        continue;
      }

      // Skip if already processed
      if (visited.has(resolvedPath)) {
        continue;
      }

      // Load and parse the referenced component
      try {
        const source = fs.readFileSync(resolvedPath, 'utf-8');

        // We need to parse this component to get its IR
        // For now, we'll use the parser directly (we'll import it in the next step)
        const referencedIR = parseComponentSource(source, resolvedPath);

        // Recursively process this component
        processComponent(referencedIR, resolvedPath, depth + 1);
      } catch (error) {
        console.error(`Error loading component from ${resolvedPath}:`, error);
      }
    }

    // Add to dependency order after processing dependencies (post-order)
    dependencyOrder.push(normalizedPath);
  }

  // Start processing from the root component
  processComponent(ir, sourcePath || null, 0);

  return {
    components,
    dependencyOrder
  };
}

/**
 * Parses a component source file to produce its IR
 *
 * This function reuses the existing parser and transformer to convert
 * a component source file into its intermediate representation.
 *
 * @param source - The component source code
 * @param filename - The filename for error messages
 * @returns The component's IR
 */
function parseComponentSource(source: string, filename: string): DurableComponentIR {
  const ast = parse(source, { filename });
  return transform(ast);
}

/**
 * Gets all unique dependencies of a component (transitive closure)
 *
 * @param sourcePath - The source path of the component
 * @param flattenResult - The flatten result containing all components
 * @returns Set of all dependency source paths (excluding the component itself)
 */
export function getComponentDependencies(
  sourcePath: string,
  flattenResult: FlattenResult
): Set<string> {
  const dependencies = new Set<string>();
  const normalizedPath = path.resolve(sourcePath);

  function collectDeps(compPath: string): void {
    const component = flattenResult.components.get(compPath);
    if (!component) return;

    for (const reference of component.references) {
      const resolvedPath = resolveComponentPath(reference.source, {
        baseDir: getBaseDir(compPath),
        extensions: ['.dce'],
        checkExists: false // We already know it exists from flattening
      });

      if (resolvedPath) {
        const normalizedRefPath = path.resolve(resolvedPath);
        if (!dependencies.has(normalizedRefPath)) {
          dependencies.add(normalizedRefPath);
          collectDeps(normalizedRefPath);
        }
      }
    }
  }

  collectDeps(normalizedPath);
  return dependencies;
}
