/**
 * Vue 3 Generator
 *
 * Transforms the canonical IR into a Vue 3 component using Composition API.
 * This implements the mapping from IR to Vue 3 reactive primitives.
 */
import type { DurableComponentIR } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
/**
 * Generate Vue 3 component from IR
 */
export declare function generateVue(ir: DurableComponentIR): CompiledJS;
