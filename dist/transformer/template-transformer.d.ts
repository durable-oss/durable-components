/**
 * Template Transformer
 *
 * Transforms template AST nodes into IR template representation
 */
import type { TemplateASTNode } from '../types/ast';
import type { TemplateNode, SnippetDefinition } from '../types/ir';
/**
 * Context for collecting snippets during transformation
 */
export interface TransformContext {
    snippets: SnippetDefinition[];
    transformNode: (node: TemplateASTNode, context: TransformContext) => TemplateNode;
}
/**
 * Transform template AST nodes to IR template nodes
 * Returns both the template and any snippets found
 */
export declare function transformTemplate(nodes: TemplateASTNode[]): {
    template: TemplateNode;
    snippets: SnippetDefinition[];
};
/**
 * Determine whether an expression AST is an inline function (arrow or
 * function expression), unwrapping Acorn's Program/ExpressionStatement/Chain
 * wrappers first.
 */
export declare function isFunctionExpression(node: any): boolean;
/**
 * Extract expression string from AST node
 */
export declare function extractExpression(node: any): string;
