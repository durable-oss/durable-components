/**
 * Vue `defineProps` emission.
 *
 * Two forms exist and they are not interchangeable:
 *
 *   defineProps<{ a?: string }>()   // type-only; requires <script setup lang="ts">
 *   defineProps({ a: String })      // runtime; values are constructors
 *
 * The generator used to emit the type-generic form regardless of the source
 * language, producing TypeScript inside a plain `<script setup>`, and to emit
 * the runtime form with TYPE NAMES as its values — `defineProps({ a: any })`,
 * where `any` is an undefined identifier at runtime.
 */

import type { DurableComponentIR } from '../types/ir';

/**
 * Map a declared type hint to the runtime constructor Vue expects. Anything
 * unrecognized — including `any` and union types — becomes `null`, which is
 * Vue's "accept any type" placeholder.
 */
export function runtimePropType(type: string | undefined): string {
  if (!type) return 'null';

  const base = type.trim().replace(/\s*\|\s*(null|undefined)\s*$/, '').trim();

  switch (base.toLowerCase()) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'function':
      return 'Function';
    case 'object':
      return 'Object';
    case 'date':
      return 'Date';
    case 'symbol':
      return 'Symbol';
    default:
      break;
  }

  if (/\[\]$/.test(base) || /^(Array|ReadonlyArray)</.test(base)) return 'Array';
  if (/^(Record|Map|Set|Partial)</.test(base)) return 'Object';
  if (/^\(.*\)\s*=>/.test(base)) return 'Function';

  // `any`, unions, interfaces, and anything else Vue cannot validate.
  return 'null';
}

/** True when the component's script is TypeScript. */
export function isTypeScript(ir: DurableComponentIR): boolean {
  return ir.lang === 'ts' || ir.lang === 'typescript';
}

/**
 * Emit the type-generic form, valid only under `<script setup lang="ts">`.
 */
function typeScriptPropsDeclaration(ir: DurableComponentIR): string {
  const members = ir.props.map((prop) => {
    const optional = prop.defaultValue ? '?' : '';
    return `  ${prop.name}${optional}: ${prop.type || 'any'};`;
  });

  const withDefaults = ir.props.filter((prop) => prop.defaultValue);
  const generic = `defineProps<{\n${members.join('\n')}\n}>()`;

  if (withDefaults.length === 0) {
    return `const props = ${generic};`;
  }

  const defaults = withDefaults.map((prop) => `  ${prop.name}: ${prop.defaultValue}`);
  return `const props = withDefaults(${generic}, {\n${defaults.join(',\n')}\n});`;
}

/**
 * Emit the runtime form, valid in both JavaScript and TypeScript. Defaults ride
 * along in each prop's descriptor rather than through `withDefaults`, which is
 * type-only.
 */
function runtimePropsDeclaration(ir: DurableComponentIR): string {
  const entries = ir.props.map((prop) => {
    const type = runtimePropType(prop.type);

    if (!prop.defaultValue) {
      return `  ${prop.name}: ${type}`;
    }

    // Object and array defaults have to be produced by a factory, or every
    // instance of the component shares one value.
    const needsFactory = /^\s*[[{]/.test(prop.defaultValue);
    const value = needsFactory ? `() => (${prop.defaultValue})` : prop.defaultValue;

    return `  ${prop.name}: { type: ${type}, default: ${value} }`;
  });

  return `const props = defineProps({\n${entries.join(',\n')}\n});`;
}

/**
 * Generate the `defineProps` declaration for a component, picking the form that
 * matches the source language.
 */
export function generatePropsDeclaration(ir: DurableComponentIR): string {
  return isTypeScript(ir)
    ? typeScriptPropsDeclaration(ir)
    : runtimePropsDeclaration(ir);
}
