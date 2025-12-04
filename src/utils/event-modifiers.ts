/**
 * Event Modifier Utilities
 *
 * Shared utilities for handling event modifiers across different framework generators
 */

/**
 * Generate inline wrapper code for event modifiers
 * Used by frameworks that don't have native modifier support (React, Svelte 5, Solid)
 *
 * @param modifiers - Array of modifier names (e.g., ['preventDefault', 'stopPropagation'])
 * @param handler - The handler function expression (e.g., 'handleClick')
 * @returns Inline arrow function with modifier calls
 */
export function generateModifierWrapper(modifiers: string[], handler: string): string {
  if (!modifiers || modifiers.length === 0) {
    return handler;
  }

  const modifierCalls = modifiers.map(mod => {
    switch (mod) {
      case 'preventDefault':
        return 'e.preventDefault()';
      case 'stopPropagation':
        return 'e.stopPropagation()';
      case 'stopImmediatePropagation':
        return 'e.stopImmediatePropagation()';
      case 'self':
        return 'if (e.target !== e.currentTarget) return';
      case 'trusted':
        return 'if (!e.isTrusted) return';
      case 'once':
        // Note: 'once' is harder to implement inline, frameworks should handle it natively
        // or the user should use addEventListener with { once: true }
        return '';
      case 'capture':
      case 'passive':
        // capture and passive are addEventListener options, not runtime checks
        return '';
      default:
        return ''; // Unknown modifier, ignore
    }
  }).filter(Boolean).join('; ');

  if (!modifierCalls) {
    return handler;
  }

  return `(e) => { ${modifierCalls}; ${handler}(e); }`;
}
