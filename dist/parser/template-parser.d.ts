/**
 * Template Parser
 *
 * Parses HTML-like template syntax with Svelte-style directives
 * into a template AST.
 */
import type { TemplateASTNode } from '../types/ast';
/**
 * Parse template content into AST nodes
 */
export declare function parseTemplate(input: string): TemplateASTNode[];
