/**
 * React Generator
 *
 * Transforms the canonical IR into a React functional component using Hooks.
 * This implements the mapping defined in Table 3 of the architectural plan.
 */
import type { DurableComponentIR } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
/**
 * Generate React component from IR
 */
export declare function generateReact(ir: DurableComponentIR): CompiledJS;
