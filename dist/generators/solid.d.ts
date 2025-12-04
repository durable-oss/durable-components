/**
 * SolidJS Generator
 *
 * Transforms the canonical IR into a SolidJS functional component using Solid primitives.
 * This implements the mapping from IR to SolidJS reactive primitives.
 */
import type { DurableComponentIR } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
/**
 * Generate SolidJS component from IR
 */
export declare function generateSolid(ir: DurableComponentIR): CompiledJS;
