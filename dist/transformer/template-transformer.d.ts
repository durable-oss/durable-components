/**
 * Template Transformer
 *
 * Transforms template AST nodes into IR template representation
 */
import type { TemplateASTNode } from '../types/ast';
import type { TemplateNode } from '../types/ir';
/**
 * Transform template AST nodes to IR template nodes
 */
export declare function transformTemplate(nodes: TemplateASTNode[]): TemplateNode;
