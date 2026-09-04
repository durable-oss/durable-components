/**
 * Scoped Style Generator
 *
 * Implements Svelte/Vue-style scoped CSS by appending unique attribute selectors
 * to all CSS rules and adding corresponding attributes to template elements.
 */

import type { TemplateNode } from '../types/ir';
import type { CompiledCSS } from '../types/compiler';
import { generateHash } from '../utils/string';
import { splitRules, splitSelectorList } from './css-split';
import { scopeSelector } from './selector-scope';

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
 * Add scope attributes to CSS selectors.
 *
 * Rules are split comment-aware (see `./css-split`) so a comma inside a comment
 * is not mistaken for a selector separator, and the attribute lands on each
 * selector's first compound (see `./selector-scope`) so descendants — including
 * slotted content, which never carries the scope attribute — still match.
 */
function scopeCSS(css: string, scopeId: string): string {
  const attribute = `[data-${scopeId}]`;

  const transformed = splitRules(css).map((chunk) => {
    // Comments and stray whitespace between rules pass through untouched.
    if (chunk.isTrivia) return chunk.text;

    const rule = chunk.text;
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

    const scopedSelectors = splitSelectorList(selector).map((sel) =>
      scopeSelector(sel, attribute)
    );

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
