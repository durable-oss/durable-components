/**
 * Script Analyzer
 *
 * Analyzes the JavaScript AST from the <script> block to extract
 * Runes ($state, $props, $derived, $effect) and functions.
 */
import type { PropDefinition, StateDefinition, DerivedDefinition, EffectDefinition, FunctionDefinition, ImportDefinition, TypeDefinition } from '../types/ir';
import type { ScriptBlock } from '../types/ast';
interface ScriptAnalysis {
    imports: ImportDefinition[];
    types: TypeDefinition[];
    props: PropDefinition[];
    state: StateDefinition[];
    derived: DerivedDefinition[];
    effects: EffectDefinition[];
    functions: FunctionDefinition[];
}
/**
 * Extract runes and functions from script AST
 */
export declare function extractRunesFromScript(script: ScriptBlock): ScriptAnalysis;
export {};
