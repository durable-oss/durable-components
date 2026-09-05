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
import { behaviorHelperSource, behaviorsUsedBy } from './behavior-runtime';
import {
  partitionLifecycle,
  scopedComponentName,
  scopedFor,
  type ScopedBehavior
} from './scoped-behavior';

/**
 * Generate Svelte 5 component from IR
 */
export function generateSvelte(ir: DurableComponentIR): CompiledJS {
  const scoped = partitionLifecycle(ir).scoped;

  // Generate script content
  const scriptContent = generateScriptContent(ir);

  // Generate template (HTML)
  currentScopedBehaviors = scoped;
  const templateContent = generateTemplate(ir.template);

  // Combine script and template
  const parts: string[] = [];

  if (scriptContent.trim() || ir.imports || ir.types) {
    const externalImports = generateExternalImports(ir);
    const types = generateTypes(ir);
    const behaviorHelpers = behaviorHelperSource(behaviorsUsedBy(ir.lifecycle ?? []));
    const scopedActions = generateScopedBehaviorActions(ir);
    const fullScript = joinStatements(
      externalImports,
      types,
      behaviorHelpers,
      scopedActions,
      scriptContent
    );

    const scriptLang = ir.lang === 'ts' || ir.lang === 'typescript' ? ' lang="ts"' : '';
    parts.push(`<script${scriptLang}>\n${indent(fullScript)}\n</script>`);
  }

  if (templateContent.trim()) {
    parts.push(templateContent);
  }

  const code = parts.join('\n\n');
  currentScopedBehaviors = [];

  return {
    code
  };
}

/**
 * Per-item behavior effects for the component being generated.
 *
 * The template walkers below are plain functions rather than methods on a
 * context object, so the list is held here for the duration of one
 * generateSvelte call and cleared when it returns.
 */
let currentScopedBehaviors: ScopedBehavior[] = [];

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
 * Declare the bindings that `bind:this` fills in.
 *
 * Svelte assigns the element to the variable, so an undeclared name is a
 * compile error in the emitted component. `let` with no initializer is the
 * idiomatic Svelte 5 form — a `$state` rune here would make the reference
 * reactive, which is not what a DOM handle needs.
 */
function generateRefDeclarations(ir: DurableComponentIR): string {
  return ir.refs.map((ref) => `let ${ref.name};`).join('\n');
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

  // Generate element references
  if (ir.refs.length > 0) {
    statements.push(generateRefDeclarations(ir));
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

  // Generate mount/unmount effects from the dce:* behavior primitives
  statements.push(generateLifecycleDeclarations(ir));

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
 * Generate the mount/unmount effects contributed by the dce:* primitives.
 *
 * Svelte 5 models these with `$effect`, which honours a returned teardown
 * directly — no extra plumbing needed.
 */
function generateLifecycleDeclarations(ir: DurableComponentIR): string {
  // Effects captured inside an {#each} become per-item actions instead; see
  // generateScopedBehaviorActions.
  const lifecycle = partitionLifecycle(ir).componentLevel;
  if (lifecycle.length === 0) return '';

  return lifecycle
    .map((effect) => {
      if (effect.teardown) {
        return `$effect(() => {\n${indent(
          `${effect.setup};\nreturn () => ${effect.teardown};`
        )}\n});`;
      }

      // The helper's own return value is the teardown.
      return `$effect(() => ${effect.setup});`;
    })
    .join('\n\n');
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
    const asyncPrefix = func.async ? 'async ' : '';

    return `${asyncPrefix}function ${func.name}(${params}) ${functionBody}`;
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

    case 'render':
      return generateRender(node);

    case 'comment':
      return `<!-- ${node.content} -->`;

    case 'dce-behavior':
      return generateDceBehavior(node);

    case 'dce-element':
      return generateDceElement(node, depth);

    case 'dce-window':
      return generateDceWindow(node);

    case 'dce-boundary':
      return generateDceBoundary(node, depth);

    case 'dce-head':
      return generateDceHead(node, depth);

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
    attrs.push(formatBindingAttr(key, String(value)));
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
      attrs.push(formatBindingAttr(attr.name, String(attr.value ?? '')));
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
  return `{#if ${transformExpression(node.condition)}}\n${generateIfBranches(node, depth)}\n{/if}`;
}

/**
 * Render the consequent and the else / else-if chain for an {#if} node,
 * WITHOUT the outer `{#if cond}` / `{/if}`. An `{:else if}` in the source is
 * stored as an alternate containing a single nested IfNode; we collapse that
 * back into native Svelte `{:else if}` rather than nesting a fresh `{#if}`
 * inside an `{:else}`.
 */
function generateIfBranches(node: any, depth: number): string {
  const consequent = node.consequent
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!node.alternate || node.alternate.length === 0) {
    return indent(consequent);
  }

  // Collapse `{:else}{#if}` into `{:else if}` when the else branch is exactly
  // one IfNode (the shape produced by parsing `{:else if}`).
  if (node.alternate.length === 1 && node.alternate[0].type === 'if') {
    const elseIf = node.alternate[0];
    return `${indent(consequent)}\n{:else if ${transformExpression(elseIf.condition)}}\n${generateIfBranches(elseIf, depth)}`;
  }

  const alternate = node.alternate
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `${indent(consequent)}\n{:else}\n${indent(alternate)}`;
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
 * Generate render block (for {@render snippet()} syntax)
 * Always generates defensive code that safely handles undefined snippets
 */
function generateRender(node: any): string {
  const snippet = node.snippet;
  const args = node.args || [];
  const argsList = args.length > 0 ? args.join(', ') : '';

  // Svelte 5 uses {@render} syntax natively - always use optional chaining
  return `{@render ${snippet}?.(${argsList})}`;
}

/**
 * Format an element binding as a Svelte attribute.
 *
 * The IR stores a static value as a quoted string ("foo") and a dynamic value
 * as a bare expression (snap.id) or a template literal (`base ${cond}`). Svelte
 * needs static values as `key="foo"` and dynamic ones wrapped in braces:
 * `key={expr}`. Emitting a bare expression without braces produces invalid
 * Svelte, which is the unquoted-attribute bug.
 */
function formatBindingAttr(key: string, rawValue: string): string {
  const isStaticString =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"));

  if (isStaticString) {
    // Keep the original quoting for a plain static attribute.
    return `${key}=${rawValue}`;
  }

  let valueStr = transformExpression(rawValue);
  valueStr = valueStr.replace(/\bclass\b/g, 'className');
  return `${key}={${valueStr}}`;
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

/**
 * Generate dce:element (dynamic element)
 */
function generateDceElement(node: any, depth: number): string {
  const { tagExpression, attributes = [], bindings = {}, children = [] } = node;

  // Transform the tag expression
  const tag = transformExpression(tagExpression);

  // Collect all attributes
  const attrs: string[] = [];

  // Svelte 5 uses this attribute for dynamic elements
  attrs.push(`this={${tag}}`);

  // Handle bindings
  for (const [key, value] of Object.entries(bindings)) {
    attrs.push(formatBindingAttr(key, String(value)));
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      const eventName = attr.name.slice(3);
      const handler = transformExpression(attr.value);
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;
      attrs.push(`on${eventName}={${finalHandler}}`);
    } else if (attr.name.startsWith('bind:')) {
      const varName = transformExpression(attr.value);
      attrs.push(`${attr.name}={${varName}}`);
    } else if (attr.name.startsWith('class:')) {
      const condition = transformExpression(attr.value);
      attrs.push(`${attr.name}={${condition}}`);
    } else {
      attrs.push(formatBindingAttr(attr.name, String(attr.value ?? '')));
    }
  }

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<svelte:element${attrsStr} />`;
  }

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenHTML.trim()) {
    return `<svelte:element${attrsStr} />`;
  }

  const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;

  if (hasMultipleLines) {
    return `<svelte:element${attrsStr}>\n${indent(childrenHTML)}\n</svelte:element>`;
  } else {
    return `<svelte:element${attrsStr}>${childrenHTML}</svelte:element>`;
  }
}

/**
 * Generate dce:window (window event handlers)
 */
function generateDceWindow(_node: any): string {
  // Svelte's native <svelte:window> is only legal at the top level of a
  // component, but a multi-root template is wrapped in a <div>, so emitting it
  // here produced `svelte_meta_invalid_placement`. The listeners are registered
  // through the shared lifecycle path instead, which has no placement rule and
  // behaves identically.
  return '';
}

/**
 * Generate dce:boundary (error boundary)
 */
function generateDceBoundary(node: any, depth: number): string {
  // Svelte doesn't have a built-in error boundary
  // Users would need to create a wrapper component
  const { children = [], attributes = [] } = node;

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  // Find the onerror handler if specified
  let onError = 'console.error';
  for (const attr of attributes) {
    if (attr.name === 'onerror') {
      onError = transformExpression(attr.value);
    }
  }

  const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;

  if (hasMultipleLines) {
    return `<ErrorBoundary onerror={${onError}}>\n${indent(childrenHTML)}\n</ErrorBoundary>`;
  } else {
    return `<ErrorBoundary onerror={${onError}}>${childrenHTML}</ErrorBoundary>`;
  }
}

/**
 * Generate dce:head (document head)
 */
function generateDceHead(node: any, depth: number): string {
  // Svelte has built-in <svelte:head> for document head
  const { children = [] } = node;

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenHTML.trim()) {
    return '<svelte:head />';
  }

  const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;

  if (hasMultipleLines) {
    return `<svelte:head>\n${indent(childrenHTML)}\n</svelte:head>`;
  } else {
    return `<svelte:head>${childrenHTML}</svelte:head>`;
  }
}


/**
 * Render the placeholder a behavior primitive leaves in the template.
 *
 * Component-level effects render nothing. One captured inside an {#each}
 * attaches its generated action to a zero-size element inside the loop body,
 * so the effect runs once per item and tears down when that item is removed.
 */
function generateDceBehavior(node: any): string {
  const scoped = scopedFor(currentScopedBehaviors, node.scope);
  if (!scoped) return '';

  const name = scopedActionName(scoped);
  const args = scoped.props.join(', ');

  // An action needs a host element. `display: contents` keeps it out of layout
  // while still giving the action something to attach to.
  return `<span style="display: contents" use:${name}={[${args}]}></span>`;
}

/**
 * The action name for a per-item behavior effect.
 */
function scopedActionName(scoped: ScopedBehavior): string {
  return `__dceScoped_${scoped.scope.id}`;
}

/**
 * Emit one Svelte action per behavior effect captured inside an {#each}.
 *
 * Svelte output is a single file, so a per-item child component is not
 * available. An action is the equivalent: it runs when its element is created,
 * receives the loop bindings as a parameter, and its `destroy` runs when that
 * one item leaves the list.
 */
function generateScopedBehaviorActions(ir: DurableComponentIR): string {
  const { scoped } = partitionLifecycle(ir);
  if (scoped.length === 0) return '';

  return scoped
    .map((entry) => {
      const { effect, props } = entry;
      const name = scopedActionName(entry);
      const destructure = `[${props.join(', ')}]`;

      const teardown = effect.teardown
        ? `${effect.setup};\n    const __dceDestroy = () => ${effect.teardown};`
        : `const __dceDestroy = ${effect.setup};`;

      return `function ${name}(__dceNode, ${destructure}) {\n${indent(
        `${teardown}\n\nreturn {\n${indent(
          `destroy() {\n${indent(
            `if (typeof __dceDestroy === 'function') __dceDestroy();`
          )}\n}`
        )}\n};`
      )}\n}`;
    })
    .join('\n\n');
}
