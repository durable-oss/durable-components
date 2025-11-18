/**
 * Scoped Style Generator
 *
 * Implements Svelte/Vue-style scoped CSS by appending unique attribute selectors
 * to all CSS rules and adding corresponding attributes to template elements.
 */

import type { TemplateNode } from '../types/ir';
import type { CompiledCSS } from '../types/compiler';
import { generateHash } from '../utils/string';

/**
 * Generate scoped CSS
 */
export function generateScopedCSS(
  styles: string,
  componentName: string
): { css: CompiledCSS; scopeId: string } {
  if (!styles || !styles.trim()) {
    return {
      css: { code: '' },
      scopeId: ''
    };
  }

  // Generate stable scope ID
  const scopeId = generateHash(componentName + styles);

  // Transform CSS rules to add scope attribute
  const scopedCSS = scopeCSS(styles, scopeId);

  return {
    css: { code: scopedCSS },
    scopeId
  };
}

/**
 * Add scope attributes to CSS selectors
 */
function scopeCSS(css: string, scopeId: string): string {
  // This is a simplified CSS parser
  // For production, consider using a proper CSS AST parser

  const attribute = `[data-${scopeId}]`;

  // Split by rule blocks
  const rules: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    current += char;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        rules.push(current.trim());
        current = '';
      }
    }
  }

  // Add any remaining content
  if (current.trim()) {
    rules.push(current.trim());
  }

  // Transform each rule
  const transformed = rules.map((rule) => {
    // Split selector from body
    const openBrace = rule.indexOf('{');
    if (openBrace === -1) return rule;

    const selector = rule.slice(0, openBrace).trim();
    const body = rule.slice(openBrace);

    // Skip @-rules (keyframes, media, etc.)
    if (selector.startsWith('@')) {
      // For @media, @supports, etc., scope the nested rules
      if (selector.startsWith('@media') || selector.startsWith('@supports')) {
        // Extract and scope nested rules
        const inner = body.slice(1, -1); // Remove outer braces
        const scopedInner = scopeCSS(inner, scopeId);
        return `${selector} {\n${scopedInner}\n}`;
      }
      return rule;
    }

    // Split multiple selectors (,)
    const selectors = selector.split(',').map((s) => s.trim());

    // Add scope attribute to each selector
    const scopedSelectors = selectors.map((sel) => {
      // Handle pseudo-elements (::before, ::after)
      const pseudoElementMatch = sel.match(/(.*?)(::[\w-]+.*)/);
      if (pseudoElementMatch) {
        return `${pseudoElementMatch[1]}${attribute}${pseudoElementMatch[2]}`;
      }

      // Handle pseudo-classes (:hover, :focus, etc.)
      const pseudoClassMatch = sel.match(/(.*?)(:[^:\s]+.*)/);
      if (pseudoClassMatch) {
        return `${pseudoClassMatch[1]}${attribute}${pseudoClassMatch[2]}`;
      }

      // Simple selector
      return `${sel}${attribute}`;
    });

    return `${scopedSelectors.join(', ')} ${body}`;
  });

  return transformed.join('\n\n');
}

/**
 * Add scope attributes to template nodes
 */
export function addScopeToTemplate(node: TemplateNode, scopeId: string): TemplateNode {
  if (!scopeId) return node;

  if (node.type === 'element') {
    // Add scope attribute to bindings
    const bindings = node.bindings || {};
    bindings[`data-${scopeId}`] = '""'; // Empty string value

    return {
      ...node,
      bindings,
      children: node.children?.map((child) => addScopeToTemplate(child, scopeId))
    };
  }

  if (node.type === 'if') {
    return {
      ...node,
      consequent: node.consequent.map((child) => addScopeToTemplate(child, scopeId)),
      alternate: node.alternate?.map((child) => addScopeToTemplate(child, scopeId))
    };
  }

  if (node.type === 'each') {
    return {
      ...node,
      children: node.children.map((child) => addScopeToTemplate(child, scopeId))
    };
  }

  if (node.type === 'slot') {
    return {
      ...node,
      fallback: node.fallback?.map((child) => addScopeToTemplate(child, scopeId))
    };
  }

  return node;
}
