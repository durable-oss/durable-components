/**
 * CSS inline-style helpers.
 *
 * React's `style` prop takes an object keyed by camelCased CSS properties, not
 * the CSS text every other target accepts. These helpers convert a declaration
 * string to that object shape at compile time when the value is static, and
 * name the runtime helper the React generator emits when it is not.
 */

/** Name of the runtime helper the React generator emits for dynamic styles. */
export const STYLE_HELPER_NAME = '__dceStyle';

/**
 * Source of the runtime helper. Converts a CSS declaration string into a React
 * style object; anything that is not a string (an object, null, undefined) is
 * passed through untouched, so `style={someObject}` keeps working.
 */
export const STYLE_HELPER_SOURCE = `function ${STYLE_HELPER_NAME}(value: any): any {
  if (typeof value !== 'string') return value;
  const style: Record<string, string> = {};
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (!property || !propertyValue) continue;
    style[property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_: string, character: string) => character.toUpperCase())] = propertyValue;
  }
  return style;
}`;

/**
 * Convert a CSS property name to its React style-object key. Custom properties
 * (`--du-skeleton-w`) are used verbatim; React passes those straight through.
 */
export function cssPropertyToReactKey(property: string): string {
  if (property.startsWith('--')) return property;
  return property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

/**
 * Parse a static CSS declaration string into `{ key: value }` pairs. Returns
 * null when the string cannot be parsed as plain declarations, in which case
 * the caller should fall back to the runtime helper.
 */
export function parseStaticStyle(css: string): Record<string, string> | null {
  const style: Record<string, string> = {};

  for (const declaration of css.split(';')) {
    if (!declaration.trim()) continue;

    const colon = declaration.indexOf(':');
    if (colon === -1) return null;

    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!property || !value) return null;

    style[cssPropertyToReactKey(property)] = value;
  }

  return style;
}
