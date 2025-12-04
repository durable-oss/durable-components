/**
 * Svelte 5 Generator
 *
 * Transforms the canonical IR into a Svelte 5 component using Runes.
 * Since the DSL is based on Svelte 5 Runes, this is essentially a reverse transformation.
 */
import type { DurableComponentIR } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
/**
 * Generate Svelte 5 component from IR
 */
export declare function generateSvelte(ir: DurableComponentIR): CompiledJS;
