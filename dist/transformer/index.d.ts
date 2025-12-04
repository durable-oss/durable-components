/**
 * Phase 2: Transformer
 *
 * Transforms the D-AST into the canonical JSON Intermediate Representation (IR).
 * This is the "Durable core" that performs analysis and linking, creating a
 * completely framework-agnostic representation of the component.
 */
import type { DurableComponentAST } from '../types/ast';
import type { DurableComponentIR } from '../types/ir';
/**
 * Transform D-AST to IR
 */
export declare function transform(ast: DurableComponentAST): DurableComponentIR;
