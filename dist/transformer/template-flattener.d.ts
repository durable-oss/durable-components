/**
 * Template Flattener
 *
 * This module implements template flattening - the process of inlining
 * component templates directly into the parent component's template.
 *
 * Example:
 *   <Button>OK!</Button>
 * becomes:
 *   <button class="m-2">OK!</button>
 */
import type { DurableComponentIR } from '../types/ir';
/**
 * Options for template flattening
 */
export interface FlattenTemplateOptions {
    /** Source file path for resolving relative imports */
    sourcePath: string;
    /** Maximum recursion depth to prevent infinite loops */
    maxDepth?: number;
}
/**
 * Flatten component templates in the IR
 *
 * This function walks the template tree and replaces component usage
 * with the actual template content from the component files.
 *
 * @param ir - The component IR to flatten
 * @param options - Flattening options
 * @returns Modified IR with flattened templates
 */
export declare function flattenComponentTemplates(ir: DurableComponentIR, options: FlattenTemplateOptions): DurableComponentIR;
