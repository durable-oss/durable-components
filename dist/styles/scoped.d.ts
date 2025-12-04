/**
 * Scoped Style Generator
 *
 * Implements Svelte/Vue-style scoped CSS by appending unique attribute selectors
 * to all CSS rules and adding corresponding attributes to template elements.
 */
import type { TemplateNode } from '../types/ir';
import type { CompiledCSS } from '../types/compiler';
/**
 * Generate scoped CSS
 */
export declare function generateScopedCSS(styles: string, componentName: string): {
    css: CompiledCSS;
    scopeId: string;
};
/**
 * Add scope attributes to template nodes
 */
export declare function addScopeToTemplate(node: TemplateNode, scopeId: string): TemplateNode;
