/**
 * Svelte 5 Generator
 *
 * Transforms the canonical IR into a Svelte 5 component using Runes.
 * Since the DSL is based on Svelte 5 Runes, this is essentially a reverse transformation.
 */

import type { DurableComponentIR, TemplateNode } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
import { indent, joinStatements } from '../utils/code-gen';
import { generateModifierWrapper } from '../utils/event-modifiers';

/**
 * Generate Svelte 5 component from IR
 */
export function generateSvelte(ir: DurableComponentIR): CompiledJS {
  // Generate script content
  const scriptContent = generateScriptContent(ir);

  // Generate template (HTML)
  const templateContent = generateTemplate(ir.template);

  // Combine script and template
  const parts: string[] = [];

  if (scriptContent.trim() || ir.imports || ir.types) {
    const externalImports = generateExternalImports(ir);
    const types = generateTypes(ir);
    const fullScript = joinStatements(externalImports, types, scriptContent);

    const scriptLang = ir.lang === 'ts' || ir.lang === 'typescript' ? ' lang="ts"' : '';
    parts.push(`<script${scriptLang}>\n${indent(fullScript)}\n</script>`);
  }

  if (templateContent.trim()) {
    parts.push(templateContent);
  }

  const code = parts.join('\n\n');

  return {
    code
  };
}

/**
 * Generate external module imports
 */
function generateExternalImports(ir: DurableComponentIR): string {
  if (!ir.imports || ir.imports.length === 0) return '';

  const imports = ir.imports.map((imp) => {
    const specifiers: string[] = [];

    for (const spec of imp.specifiers) {
      if (spec.type === 'default') {
        specifiers.push(spec.local);
      } else if (spec.type === 'named') {
        if (spec.imported && spec.imported !== spec.local) {
          specifiers.push(`${spec.imported} as ${spec.local}`);
        } else {
          specifiers.push(spec.local);
        }
      } else if (spec.type === 'namespace') {
        return `import * as ${spec.local} from '${imp.source}';`;
      }
    }

    if (specifiers.length === 0) {
      return `import '${imp.source}';`;
    }

    // Check if we have both default and named imports
    const defaultImport = imp.specifiers.find(s => s.type === 'default');
    const namedImports = imp.specifiers.filter(s => s.type === 'named');

    if (defaultImport && namedImports.length > 0) {
      const namedSpecs = namedImports.map(s =>
        s.imported && s.imported !== s.local ? `${s.imported} as ${s.local}` : s.local
      );
      return `import ${defaultImport.local}, { ${namedSpecs.join(', ')} } from '${imp.source}';`;
    } else if (defaultImport) {
      return `import ${defaultImport.local} from '${imp.source}';`;
    } else {
      return `import { ${specifiers.join(', ')} } from '${imp.source}';`;
    }
  });

  return imports.join('\n');
}

/**
 * Generate TypeScript type definitions
 */
function generateTypes(ir: DurableComponentIR): string {
  if (!ir.types || ir.types.length === 0) return '';

  return ir.types.map(type => type.body).join('\n\n');
}

/**
 * Generate script section content
 */
function generateScriptContent(ir: DurableComponentIR): string {
  const statements: string[] = [];

  // Generate props
  if (ir.props.length > 0) {
    statements.push(generatePropsDeclaration(ir));
  }

  // Generate state
  if (ir.state.length > 0) {
    statements.push(generateStateDeclarations(ir));
  }

  // Generate derived values
  if (ir.derived.length > 0) {
    statements.push(generateDerivedDeclarations(ir));
  }

  // Generate effects
  if (ir.effects.length > 0) {
    statements.push(generateEffectDeclarations(ir));
  }

  // Generate functions
  if (ir.functions.length > 0) {
    statements.push(generateFunctionDeclarations(ir));
  }

  return statements.filter(Boolean).join('\n\n');
}

/**
 * Generate $props() declaration
 */
function generatePropsDeclaration(ir: DurableComponentIR): string {
  const propsList = ir.props.map((prop) => {
    // Rename reserved keywords to avoid parse errors
    const propName = prop.name === 'class' ? 'class: className' : prop.name;

    if (prop.defaultValue) {
      return `${propName} = ${prop.defaultValue}`;
    }
    return propName;
  });

  return `let { ${propsList.join(', ')} } = $props();`;
}

/**
 * Generate $state() declarations
 */
function generateStateDeclarations(ir: DurableComponentIR): string {
  const declarations = ir.state.map((state) => {
    let initialValue = state.initialValue;

    // Replace prop references (props.x -> x)
    for (const prop of ir.props) {
      initialValue = initialValue.replace(
        new RegExp(`\\bprops\\.${prop.name}\\b`, 'g'),
        prop.name
      );
    }

    return `let ${state.name} = $state(${initialValue});`;
  });

  return declarations.join('\n');
}

/**
 * Generate $derived() declarations
 */
function generateDerivedDeclarations(ir: DurableComponentIR): string {
  const declarations = ir.derived.map((derived) => {
    const expr = transformExpression(derived.expression);
    return `let ${derived.name} = $derived(${expr});`;
  });

  return declarations.join('\n');
}

/**
 * Generate $effect() declarations
 */
function generateEffectDeclarations(ir: DurableComponentIR): string {
  const declarations = ir.effects.map((effect) => {
    const expr = transformExpression(effect.expression);

    // If the expression is already a block, use it directly
    // Otherwise, wrap it in an arrow function
    if (expr.startsWith('{')) {
      return `$effect(() => ${expr});`;
    } else {
      return `$effect(() => {\n${indent(expr)}\n});`;
    }
  });

  return declarations.join('\n\n');
}

/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir: DurableComponentIR): string {
  const declarations = ir.functions.map((func) => {
    const params = func.params?.join(', ') || '';
    let body = func.body;

    // Transform state updates (already correct for Svelte 5)
    // In Svelte 5, we can directly mutate state: count++
    // The body should already be in the correct format from the IR

    // Handle block vs expression body
    const functionBody = body.startsWith('{') ? body : `{\n${indent(body)}\n}`;

    return `function ${func.name}(${params}) ${functionBody}`;
  });

  return declarations.join('\n\n');
}

/**
 * Generate template (HTML)
 */
function generateTemplate(node: TemplateNode, depth: number = 0): string {
  switch (node.type) {
    case 'element':
      return generateElement(node, depth);

    case 'text':
      return node.content;

    case 'expression':
      return `{${transformExpression(node.expression)}}`;

    case 'if':
      return generateIf(node, depth);

    case 'each':
      return generateEach(node, depth);

    case 'slot':
      return generateSlot(node);

    case 'comment':
      return `<!-- ${node.content} -->`;

    default:
      return '';
  }
}

/**
 * Generate element
 */
function generateElement(node: any, depth: number): string {
  const { name, attributes = [], bindings = {}, children = [] } = node;

  // Collect all attributes
  const attrs: string[] = [];

  // Handle bindings (e.g., class bindings)
  for (const [key, value] of Object.entries(bindings)) {
    let valueStr = transformExpression(String(value));
    // Replace class prop reference with className
    valueStr = valueStr.replace(/\bclass\b/g, 'className');
    attrs.push(`${key}=${valueStr}`);
  }

  // Handle attributes (events, bindings, etc.)
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      // Event handler: Transform on:click to onclick for Svelte 5
      const eventName = attr.name.slice(3); // Remove 'on:' prefix
      const handler = transformExpression(attr.value);

      // Handle event modifiers (Svelte 5 doesn't have native modifier support)
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;

      attrs.push(`on${eventName}={${finalHandler}}`);
    } else if (attr.name.startsWith('bind:')) {
      // Two-way binding: bind:value={var}
      const varName = transformExpression(attr.value);
      attrs.push(`${attr.name}={${varName}}`);
    } else if (attr.name.startsWith('class:')) {
      // Class directive: class:active={isActive}
      const condition = transformExpression(attr.value);
      attrs.push(`${attr.name}={${condition}}`);
    } else {
      // Regular attribute
      attrs.push(`${attr.name}="${attr.value}"`);
    }
  }

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<${name}${attrsStr} />`;
  }

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenHTML.trim()) {
    return `<${name}${attrsStr} />`;
  }

  // Check if children should be indented
  const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;

  if (hasMultipleLines) {
    return `<${name}${attrsStr}>\n${indent(childrenHTML)}\n</${name}>`;
  } else {
    return `<${name}${attrsStr}>${childrenHTML}</${name}>`;
  }
}

/**
 * Generate if block
 */
function generateIf(node: any, depth: number): string {
  const condition = transformExpression(node.condition);
  const consequent = node.consequent
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!node.alternate) {
    return `{#if ${condition}}\n${indent(consequent)}\n{/if}`;
  }

  const alternate = node.alternate
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `{#if ${condition}}\n${indent(consequent)}\n{:else}\n${indent(alternate)}\n{/if}`;
}

/**
 * Generate each block
 */
function generateEach(node: any, depth: number): string {
  const array = transformExpression(node.expression);
  const item = node.itemName;
  const index = node.indexName;
  const key = node.key;

  const children = node.children
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  // Build each header
  let eachHeader = `{#each ${array} as ${item}`;
  if (index) {
    eachHeader += `, ${index}`;
  }
  if (key) {
    eachHeader += ` (${key})`;
  }
  eachHeader += '}';

  return `${eachHeader}\n${indent(children)}\n{/each}`;
}

/**
 * Generate slot
 */
function generateSlot(node: any): string {
  if (node.name) {
    return `<slot name="${node.name}" />`;
  }

  if (node.fallback && node.fallback.length > 0) {
    const fallbackHTML = node.fallback
      .map((child: any) => generateTemplate(child, 1))
      .filter(Boolean)
      .join('\n');
    return `<slot>\n${indent(fallbackHTML)}\n</slot>`;
  }

  return '<slot />';
}

/**
 * Transform IR expression to Svelte expression
 * Remove IR prefixes (state., props., derived., functions.)
 */
function transformExpression(expr: string): string {
  let transformed = expr;

  // Replace props.class with className before removing props prefix
  transformed = transformed.replace(/\bprops\.class\b/g, 'className');

  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, '');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  return transformed;
}
