/**
 * Component Reference Flattener
 *
 * Recursively compiles all DCE components referenced by a component,
 * producing a flat output of all required components.
 */
import type { DurableComponentIR } from '../types/ir';
import type { CompilerTarget, StyleMode } from '../types/compiler';
import { type ComponentReference } from './component-analyzer';
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
export declare function flattenComponentReferences(ir: DurableComponentIR, options: FlattenOptions): FlattenResult;
/**
 * Gets all unique dependencies of a component (transitive closure)
 *
 * @param sourcePath - The source path of the component
 * @param flattenResult - The flatten result containing all components
 * @returns Set of all dependency source paths (excluding the component itself)
 */
export declare function getComponentDependencies(sourcePath: string, flattenResult: FlattenResult): Set<string>;
