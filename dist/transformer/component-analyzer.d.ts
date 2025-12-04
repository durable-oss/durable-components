/**
 * Component Reference Analyzer
 *
 * Analyzes template nodes to identify which elements are references to
 * DCE components (vs. regular HTML elements) and extracts their usage.
 */
import type { DurableComponentIR } from '../types/ir';
/**
 * Represents a component reference found in the template
 */
export interface ComponentReference {
    /** The name of the component as used in the template */
    name: string;
    /** The import source path for this component */
    source: string;
    /** The local name from the import (may differ from name due to aliases) */
    localName: string;
    /** Whether this is a default import */
    isDefault: boolean;
}
/**
 * Analyzes a component's IR to find all DCE component references in the template
 *
 * @param ir - The component's intermediate representation
 * @returns Array of component references found in the template
 */
export declare function analyzeComponentReferences(ir: DurableComponentIR): ComponentReference[];
/**
 * Checks if a source path is likely a DCE component import
 *
 * DCE components are identified by:
 * - Relative imports (starting with ./ or ../)
 * - Ending with .dce extension (optional, as it may be implied)
 *
 * @param source - The import source path
 * @returns True if this is likely a DCE component import
 */
export declare function isDCEComponentImport(source: string): boolean;
/**
 * Filters component references to only include DCE components
 *
 * @param references - Array of component references
 * @returns Array of references that are DCE components
 */
export declare function filterDCEComponents(references: ComponentReference[]): ComponentReference[];
