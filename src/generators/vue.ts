/**
 * Vue 3 Generator
 *
 * Transforms the canonical IR into a Vue 3 component using Composition API.
 * This implements the mapping from IR to Vue 3 reactive primitives.
 */

import type { DurableComponentIR, TemplateNode } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
import { indent, joinStatements } from '../utils/code-gen';
import { arrowBody } from '../utils/arrow-body';
import { withRefAccess } from '../utils/ref-access';
import { generatePropsDeclaration, isTypeScript } from './vue-props';
import { returnsTeardown } from '../utils/effect-cleanup';
import {
  behaviorHelperSource,
  behaviorsUsedBy,
  type BehaviorHelper
} from './behavior-runtime';
import {
  partitionLifecycle,
  scopedFor,
  type ScopedBehavior
} from './scoped-behavior';

interface GeneratorContext {
  /** Track used composables for imports */
  usedComposables: Set<string>;
  /** Track state refs for reference */
  stateRefs: Set<string>;
  /** Track computed values */
  computedNames: Set<string>;
  /** Behavior helpers the emitted lifecycle effects call */
  usedBehaviors: Set<BehaviorHelper>;
  /** Per-item behavior effects captured inside an {#each} */
  scopedBehaviors: ScopedBehavior[];
  /** Track prop names, which are reached through the `props` object in script scope */
  propNames: Set<string>;
  /** Component name */
  componentName: string;
}

/**
 * Render `name="value"` for a Vue attribute whose value is a JS expression
 * (`:prop`, `v-if`, `@event`, `v-for`, …).
 *
 * Expression string literals are serialized with double quotes (JSON.stringify
 * in the transformer), so dropping a raw expression into a double-quoted HTML
 * attribute produces broken markup like `v-if="snap.step === "upload""`. Pick a
 * delimiter the value doesn't contain; if it contains both, keep double quotes
 * and escape the embedded ones as `&quot;` (Vue's template compiler decodes the
 * entity before evaluating the expression).
 */
function vueDynamicAttr(name: string, value: string): string {
  const hasDouble = value.includes('"');
  const hasSingle = value.includes("'");

  if (!hasDouble) {
    return `${name}="${value}"`;
  }
  if (!hasSingle) {
    return `${name}='${value}'`;
  }
  return `${name}="${value.replace(/"/g, '&quot;')}"`;
}

/**
 * Generate Vue 3 component from IR
 */
export function generateVue(ir: DurableComponentIR, options: { browserSafe?: boolean } = {}): CompiledJS {
  const ctx: GeneratorContext = {
    usedComposables: new Set(),
    stateRefs: new Set(),
    computedNames: new Set(),
    usedBehaviors: new Set(),
    scopedBehaviors: partitionLifecycle(ir).scoped,
    propNames: new Set(ir.props.map((prop) => prop.name)),
    componentName: ir.name
  };

  if (options.browserSafe) {
    return generateVueBrowser(ir, ctx);
  }

  // Generate script setup content
  const scriptContent = generateScriptSetup(ir, ctx);

  // Generate template (HTML)
  const templateContent = generateTemplate(ir.template, ctx);

  // Per-item behavior directives. Generated after the template so the
  // placeholders above have registered which ones are actually referenced.
  const scopedDirectives = generateScopedBehaviorDirectives(ir, ctx);

  // Combine script and template
  const parts: string[] = [];

  if (scriptContent.trim() || ir.imports || ir.types) {
    // Generate imports
    const vueImports = generateVueImports(ctx);
    const externalImports = generateExternalImports(ir);
    const types = generateTypes(ir);
    const imports = joinStatements(vueImports, externalImports);
    const behaviorHelpers = behaviorHelperSource(ctx.usedBehaviors);
    const fullScript = joinStatements(
      imports,
      types,
      behaviorHelpers,
      scopedDirectives,
      scriptContent
    );

    // The script has to be marked as TypeScript whenever it actually contains
    // any: a TS source, or emitted type declarations. Props no longer force it
    // — a JS component gets the runtime `defineProps` form instead.
    const scriptLang = isTypeScript(ir) || types.trim() ? ' lang="ts"' : '';
    parts.push(`<script setup${scriptLang}>\n${indent(fullScript)}\n</script>`);
  }

  if (templateContent.trim()) {
    parts.push(`<template>\n${indent(templateContent)}\n</template>`);
  }

  const code = parts.join('\n\n');

  return { code };
}

/**
 * Generate a browser-compatible Vue 3 options API component with inline template.
 * Uses Vue's runtime compiler (included in vue.global.js) to compile the template.
 */
function generateVueBrowser(ir: DurableComponentIR, ctx: GeneratorContext): CompiledJS {
  const templateContent = generateTemplate(ir.template, ctx);

  // Generate setup body without props declaration (props come from setup parameter)
  const statements: string[] = [];

  if (ir.state.length > 0) {
    ctx.usedComposables.add('ref');
    statements.push(generateStateDeclarations(ir, ctx));
  }
  if (ir.derived.length > 0) {
    ctx.usedComposables.add('computed');
    statements.push(generateDerivedDeclarations(ir, ctx));
  }
  if (ir.effects.length > 0) {
    ctx.usedComposables.add('watchEffect');
    statements.push(generateEffectDeclarations(ir, ctx));
  }
  if (ir.functions.length > 0) {
    statements.push(generateFunctionDeclarations(ir, ctx));
  }
  statements.push(generateLifecycleDeclarations(ir, ctx));

  const returnNames = [
    ...Array.from(ctx.stateRefs),
    ...Array.from(ctx.computedNames),
    ...ir.functions.map(f => f.name),
  ];

  const setupBody = [
    ...statements,
    returnNames.length > 0 ? `return { ${returnNames.join(', ')} };` : '',
  ].filter(Boolean).join('\n\n');

  const composables = Array.from(ctx.usedComposables).sort();

  const propsDefinition = ir.props.length > 0
    ? ir.props.map(p => `${p.name}: { default: ${p.defaultValue ?? 'undefined'} }`).join(', ')
    : '';

  const templateStr = templateContent.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

  const code = [
    composables.length > 0 ? `import { ${composables.join(', ')} } from 'vue';` : '',
    `export default {`,
    propsDefinition ? `  props: { ${propsDefinition} },` : '',
    `  setup(props) {`,
    indent(indent(setupBody)),
    `  },`,
    `  template: \`${templateStr}\`,`,
    `};`,
  ].filter(Boolean).join('\n');

  return { code };
}

/**
 * Generate Vue imports based on used composables
 */
function generateVueImports(ctx: GeneratorContext): string {
  if (ctx.usedComposables.size === 0) {
    return '';
  }

  const composables = Array.from(ctx.usedComposables).sort();
  return `import { ${composables.join(', ')} } from 'vue';`;
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
 * Generate script setup section content
 */
function generateScriptSetup(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const statements: string[] = [];

  // Generate props
  if (ir.props.length > 0) {
    statements.push(generatePropsDeclaration(ir));
  }

  // Generate state (refs)
  if (ir.state.length > 0) {
    ctx.usedComposables.add('ref');
    statements.push(generateStateDeclarations(ir, ctx));
  }

  // Generate element references (bind:this). These are refs like any other, so
  // registering them makes script-scope expressions reach them through .value.
  if (ir.refs && ir.refs.length > 0) {
    ctx.usedComposables.add('ref');
    for (const elementRef of ir.refs) {
      ctx.stateRefs.add(elementRef.name);
    }
    statements.push(
      ir.refs.map((elementRef) => `const ${elementRef.name} = ref(null);`).join('\n')
    );
  }

  // Generate derived values (computed)
  if (ir.derived.length > 0) {
    ctx.usedComposables.add('computed');
    statements.push(generateDerivedDeclarations(ir, ctx));
  }

  // Generate effects (watchEffect)
  if (ir.effects.length > 0) {
    ctx.usedComposables.add('watchEffect');
    statements.push(generateEffectDeclarations(ir, ctx));
  }

  // Generate functions
  if (ir.functions.length > 0) {
    statements.push(generateFunctionDeclarations(ir, ctx));
  }

  // Generate mount/unmount effects from the dce:* behavior primitives. These
  // come after the function declarations because a primitive's handler is
  // usually one of them, and the emitted functions are `const` — referencing
  // one earlier would hit the temporal dead zone.
  statements.push(generateLifecycleDeclarations(ir, ctx));

  return statements.filter(Boolean).join('\n\n');
}

/**
 * Generate ref() declarations for state
 */
function generateStateDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.state.map((state) => {
    ctx.stateRefs.add(state.name);

    let initialValue = state.initialValue;

    // A prop used to seed state is reached through the `props` object.
    for (const prop of ir.props) {
      initialValue = qualifyIdentifier(initialValue, prop.name, `props.${prop.name}`);
    }

    return `const ${state.name} = ref(${initialValue});`;
  });

  return declarations.join('\n');
}

/**
 * Generate the mount/unmount effects contributed by the dce:* primitives.
 *
 * Vue splits these across onMounted and onUnmounted. The teardown each helper
 * returns is stashed in a module-local so the unmount hook can call it.
 */
function generateLifecycleDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  // Effects captured inside an {#each} become per-item directives instead; see
  // generateScopedBehaviorDirectives.
  const lifecycle = partitionLifecycle(ir).componentLevel;
  if (lifecycle.length === 0) return '';

  ctx.usedComposables.add('onMounted');
  ctx.usedComposables.add('onUnmounted');
  for (const helper of behaviorsUsedBy(lifecycle)) {
    ctx.usedBehaviors.add(helper);
  }

  const teardownVar = '__dceTeardowns';
  const setups = lifecycle.map((effect) => {
    // Props and refs need their script-scope accessors here, the same as any
    // other expression the generator emits into <script setup>.
    const setup = transformExpression(effect.setup, ctx);
    const teardown = effect.teardown
      ? transformExpression(effect.teardown, ctx)
      : undefined;

    return teardown
      ? `${setup};\n${teardownVar}.push(() => ${teardown});`
      : `${teardownVar}.push(${setup});`;
  });

  return [
    `const ${teardownVar} = [];`,
    `onMounted(() => {\n${indent(setups.join('\n'))}\n});`,
    `onUnmounted(() => {\n${indent(
      `${teardownVar}.forEach((fn) => { if (typeof fn === 'function') fn(); });\n${teardownVar}.length = 0;`
    )}\n});`
  ].join('\n\n');
}

/**
 * Generate computed() declarations for derived values
 */
function generateDerivedDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.derived.map((derived) => {
    ctx.computedNames.add(derived.name);

    const expr = transformExpression(derived.expression, ctx);
    // Vue doesn't need dependency arrays - it auto-tracks

    return `const ${derived.name} = computed(() => ${arrowBody(expr)});`;
  });

  return declarations.join('\n');
}

/**
 * Generate watchEffect() declarations
 */
function generateEffectDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.effects.map((effect) => {
    const expr = transformExpression(effect.expression, ctx);

    // Handle block vs expression
    const effectBody = expr.startsWith('{') ? expr : `{\n${indent(expr)}\n}`;

    // Vue discards a value returned from watchEffect; a teardown has to go
    // through the onCleanup callback it passes in. Without this every listener,
    // timer, and observer an effect sets up leaks when the component unmounts.
    if (returnsTeardown(effect.expression)) {
      return `watchEffect((onCleanup) => {\n${indent(
        `const __cleanup = (() => ${effectBody})();\nif (typeof __cleanup === 'function') onCleanup(__cleanup);`
      )}\n});`;
    }

    return `watchEffect(() => ${effectBody});`;
  });

  return declarations.join('\n\n');
}

/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.functions.map((func) => {
    const params = func.params?.join(', ') || '';
    let body = func.body;

    // First, transform all state references to use .value
    // (except when already followed by .value)
    for (const state of ir.state) {
      body = body.replace(
        new RegExp(`\\b${state.name}(?!\\.value)\\b`, 'g'),
        `${state.name}.value`
      );
    }

    // A bind:this target is a ref too, so `panel.focus()` has to reach the
    // element through .value or the call lands on the ref object and throws.
    body = withRefAccess(body, ir.refs, 'value');

    // Props are reached through the `props` object in script scope, so a bare
    // prop identifier has to be qualified — unless a parameter of this function
    // shadows it, in which case the local binding is what the body means.
    const shadowed = new Set(func.params || []);
    for (const propName of ctx.propNames) {
      if (shadowed.has(propName)) continue;
      body = qualifyIdentifier(body, propName, `props.${propName}`);
    }

    // Handle block vs expression body
    const functionBody = body.startsWith('{') ? body : `{\n${indent(body)}\n}`;
    const asyncPrefix = func.async ? 'async ' : '';

    return `const ${func.name} = ${asyncPrefix}(${params}) => ${functionBody};`;
  });

  return declarations.join('\n\n');
}

/**
 * Generate template (HTML)
 */
function generateTemplate(node: TemplateNode, ctx: GeneratorContext, depth: number = 0): string {
  switch (node.type) {
    case 'element':
      return generateElement(node, ctx, depth);

    case 'text':
      return node.content;

    case 'expression':
      return `{{ ${transformTemplateExpression(node.expression, ctx)} }}`;

    case 'if':
      return generateIf(node, ctx, depth);

    case 'each':
      return generateEach(node, ctx, depth);

    case 'slot':
      return generateSlot(node);

    case 'render':
      return generateRender(node);

    case 'comment':
      return `<!-- ${node.content} -->`;

    case 'dce-behavior':
      return generateDceBehavior(node, ctx);

    case 'dce-element':
      return generateDceElement(node, ctx, depth);

    case 'dce-window':
      return generateDceWindow(node, ctx);

    case 'dce-boundary':
      return generateDceBoundary(node, ctx, depth);

    case 'dce-head':
      return generateDceHead(node, ctx, depth);

    default:
      return '';
  }
}

/**
 * Generate element
 */
function generateElement(node: any, ctx: GeneratorContext, depth: number): string {
  const { name, attributes = [], bindings = {}, children = [] } = node;

  // Collect all attributes
  const attrs: string[] = [];

  // Handle bindings (e.g., class bindings)
  for (const [key, value] of Object.entries(bindings)) {
    const valueStr = String(value);

    // Check if this is a static string literal (starts and ends with quotes)
    const isStaticString = (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
                           (valueStr.startsWith("'") && valueStr.endsWith("'"));

    if (isStaticString) {
      // Static attribute - remove quotes and output as regular attribute
      const staticValue = valueStr.slice(1, -1);
      attrs.push(`${key}="${staticValue}"`);
    } else {
      // Dynamic binding
      const transformedValue = transformTemplateExpression(valueStr, ctx);
      attrs.push(vueDynamicAttr(`:${key}`, transformedValue));
    }
  }

  // Handle attributes (events, bindings, etc.)
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      // Event handler: on:click -> @click
      const eventName = attr.name.slice(3);
      const handler = transformTemplateExpression(attr.value, ctx);

      // Vue has native modifier support: @click.prevent.stop
      // Map canonical modifier names to Vue's syntax
      const vueModifiers = attr.modifiers && attr.modifiers.length > 0
        ? '.' + attr.modifiers.map((mod: string) => {
            switch (mod) {
              case 'preventDefault': return 'prevent';
              case 'stopPropagation': return 'stop';
              case 'stopImmediatePropagation': return 'stop'; // Vue doesn't have stopImmediate, use stop
              default: return mod; // Pass through self, once, capture, passive, trusted
            }
          }).join('.')
        : '';

      attrs.push(vueDynamicAttr(`@${eventName}${vueModifiers}`, handler));
    } else if (attr.name.startsWith('bind:')) {
      // Two-way binding: bind:value -> v-model
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');

      if (propName === 'value') {
        attrs.push(`v-model="${varName}"`);
      } else if (propName === 'checked') {
        attrs.push(`v-model="${varName}"`);
      } else if (propName === 'this') {
        // bind:this is an element reference, not a two-way binding — Vue
        // spells that `ref`. `v-model:this` was never a valid directive.
        attrs.push(`ref="${varName}"`);
      } else {
        // Generic binding
        attrs.push(`v-model:${propName}="${varName}"`);
      }
    } else if (attr.name.startsWith('class:')) {
      // Class directive: class:active={isActive}
      // Convert to Vue's class binding syntax
      const className = attr.name.slice(6);
      const condition = transformTemplateExpression(attr.value, ctx);
      attrs.push(vueDynamicAttr(':class', `{ '${className}': ${condition} }`));
    } else {
      // Regular attribute
      attrs.push(vueAttr(attr.name, attr.value, ctx));
    }
  }

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<${name}${attrsStr} />`;
  }

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, ctx, depth + 1))
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
function generateIf(node: any, ctx: GeneratorContext, depth: number): string {
  const condition = transformTemplateExpression(node.condition, ctx);
  const consequent = node.consequent
    .map((child: any) => generateTemplate(child, ctx, depth))
    .filter((s: string) => s.trim().length > 0)
    .join('\n');

  // Attach v-if to the consequent's first element.
  const branches = [injectDirective(consequent, vueDynamicAttr('v-if', condition))];

  // Walk the else / else-if chain. A parsed `{:else if}` is stored as an
  // alternate containing a single nested IfNode, which becomes a sibling
  // element carrying v-else-if. A plain `{:else}` becomes v-else.
  let alternate = node.alternate;
  while (alternate && alternate.length === 1 && alternate[0].type === 'if') {
    const elseIf = alternate[0];
    const elseIfCondition = transformTemplateExpression(elseIf.condition, ctx);
    const elseIfConsequent = elseIf.consequent
      .map((child: any) => generateTemplate(child, ctx, depth))
      .filter((s: string) => s.trim().length > 0)
      .join('\n');
    branches.push(injectDirective(elseIfConsequent, vueDynamicAttr('v-else-if', elseIfCondition)));
    alternate = elseIf.alternate;
  }

  if (alternate && alternate.length > 0) {
    const alternateHtml = alternate
      .map((child: any) => generateTemplate(child, ctx, depth))
      .filter((s: string) => s.trim().length > 0)
      .join('\n');
    branches.push(injectDirective(alternateHtml, 'v-else'));
  }

  return branches.join('\n');
}

/**
 * Inject a Vue directive (v-if / v-else-if / v-else) into the first element of
 * a rendered HTML fragment.
 */
function injectDirective(html: string, directive: string): string {
  const lines = html.split('\n');
  const firstIdx = lines.findIndex((line: string) => line.trim().startsWith('<'));
  if (firstIdx < 0) {
    return html;
  }
  lines[firstIdx] = lines[firstIdx].replace(/^(\s*<[a-zA-Z][\w-]*)(\s|>|\/)/, `$1 ${directive}$2`);
  return lines.join('\n');
}

/**
 * Generate each block
 */
function generateEach(node: any, ctx: GeneratorContext, depth: number): string {
  const array = transformTemplateExpression(node.expression, ctx);
  const item = node.itemName;
  const index = node.indexName;
  const key = node.key;

  const children = node.children
    .map((child: any) => generateTemplate(child, ctx, depth))
    .filter((s: string) => s.trim().length > 0)
    .join('\n');

  // Build v-for directive
  const iterator = index ? `(${item}, ${index})` : item;
  const vFor = vueDynamicAttr('v-for', `${iterator} in ${array}`);

  // Add key if specified
  const keyAttr = key ? ` ${vueDynamicAttr(':key', transformTemplateExpression(key, ctx))}` : '';

  const childLines = children.split('\n');
  const elementLines = childLines.filter((line: string) => line.trim().startsWith('<'));

  // A loop body with more than one root element has to iterate as a whole, or
  // only the first root repeats and the rest fall outside the loop scope —
  // where the item binding does not exist. <template> carries v-for without
  // adding an element to the output.
  if (elementLines.length > 1) {
    return `<template ${vFor}${keyAttr}>\n${indent(children)}\n</template>`;
  }

  // Insert v-for into the single child element
  const firstNonEmptyLine = childLines.findIndex((line: string) => line.trim().length > 0);

  if (firstNonEmptyLine >= 0 && childLines[firstNonEmptyLine].trim().startsWith('<')) {
    const firstLine = childLines[firstNonEmptyLine].replace(
      /^(\s*<[a-zA-Z][\w-]*)(\s|>|\/)/,
      `$1 ${vFor}${keyAttr}$2`
    );
    return [...childLines.slice(0, firstNonEmptyLine), firstLine, ...childLines.slice(firstNonEmptyLine + 1)].join('\n');
  }

  return children;
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
      .map((child: any) => generateTemplate(child, {} as GeneratorContext, 1))
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

  // Always generate defensive code with optional chaining
  return `{{ ${snippet}?.(${argsList}) }}`;
}

/**
 * Replace free occurrences of `name` in a JS expression with `replacement`.
 *
 * A plain regex on the identifier is not enough: it also rewrites the property
 * half of a member access (`theme.variant`), an object key (`{ variant: x }`),
 * and anything inside a string or template literal. This walks the source and
 * only substitutes an identifier that stands on its own.
 */
function qualifyIdentifier(source: string, name: string, replacement: string): string {
  const identifierChar = /[A-Za-z0-9_$]/;
  let out = '';
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    // Skip over string and template literals wholesale.
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === quote) break;
        j++;
      }
      out += source.slice(i, Math.min(j + 1, source.length));
      i = j + 1;
      continue;
    }

    if (identifierChar.test(char)) {
      let j = i;
      while (j < source.length && identifierChar.test(source[j])) j++;
      const word = source.slice(i, j);

      const prevChar = lastNonSpace(source, i - 1);
      const nextChar = source[skipSpace(source, j)];

      const isMemberAccess = prevChar === '.';
      const isObjectKey = nextChar === ':';
      const isOptionalChainMember = prevChar === '?' && source[i - 2] === '.';

      if (word === name && !isMemberAccess && !isObjectKey && !isOptionalChainMember) {
        out += replacement;
      } else {
        out += word;
      }
      i = j;
      continue;
    }

    out += char;
    i++;
  }

  return out;
}

/** Last non-whitespace character at or before `index`, or undefined. */
function lastNonSpace(source: string, index: number): string | undefined {
  let i = index;
  while (i >= 0 && /\s/.test(source[i])) i--;
  return i >= 0 ? source[i] : undefined;
}

/** Index of the first non-whitespace character at or after `index`. */
function skipSpace(source: string, index: number): number {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

/**
 * Transform IR expression to Vue expression (for script)
 * Remove IR prefixes and add .value for refs
 */
function transformExpression(expr: string, ctx: GeneratorContext): string {
  let transformed = expr;

  // Remove IR prefixes
  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, 'props.');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  // In script scope, props live on the object returned by defineProps() (or on
  // the setup() parameter), so a bare prop identifier has to be qualified. The
  // template does not need this — <script setup> exposes props by name there.
  if (ctx.propNames) {
    for (const propName of ctx.propNames) {
      transformed = qualifyIdentifier(transformed, propName, `props.${propName}`);
    }
  }

  // Add .value for state refs (except when already followed by .value)
  if (ctx.stateRefs) {
    for (const stateName of ctx.stateRefs) {
      transformed = transformed.replace(
        new RegExp(`\\b${stateName}(?!\\.value)\\b`, 'g'),
        `${stateName}.value`
      );
    }
  }

  // Add .value for computed values (they also need .value in script)
  if (ctx.computedNames) {
    for (const computedName of ctx.computedNames) {
      transformed = transformed.replace(
        new RegExp(`\\b${computedName}(?!\\.value)\\b`, 'g'),
        `${computedName}.value`
      );
    }
  }

  return transformed;
}

/**
 * Transform IR expression to Vue template expression
 * Remove IR prefixes (refs are automatically unwrapped in templates)
 */
function transformTemplateExpression(expr: string, ctx: GeneratorContext): string {
  let transformed = expr;

  // Remove IR prefixes
  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, '');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  // In Vue templates, refs are automatically unwrapped, so no need to add .value

  return transformed;
}

/**
 * Emit a regular (non-directive) attribute as a Vue template attribute.
 *
 * A quoted literal becomes a plain static attribute; anything else is an
 * expression and needs the `:` binding form, or Vue renders the source text
 * verbatim (a template literal was emitted as `style="`width: ${w}px`"`).
 */
function vueAttr(name: string, rawValue: string, ctx: GeneratorContext): string {
  const value = String(rawValue ?? '');
  const isStaticString =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));

  if (isStaticString) {
    return `${name}="${value.slice(1, -1)}"`;
  }

  return vueDynamicAttr(`:${name}`, transformTemplateExpression(value, ctx));
}

/**
 * Generate dce:element (dynamic component)
 */
function generateDceElement(node: any, ctx: GeneratorContext, depth: number): string {
  const { tagExpression, attributes = [], bindings = {}, children = [] } = node;

  // Transform the tag expression
  const componentIs = transformTemplateExpression(tagExpression, ctx);

  // Collect all attributes
  const attrs: string[] = [];

  // Vue uses :is directive for dynamic components
  attrs.push(vueDynamicAttr(':is', componentIs));

  // Handle bindings
  for (const [key, value] of Object.entries(bindings)) {
    const valueStr = String(value);
    const isStaticString = (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
                           (valueStr.startsWith("'") && valueStr.endsWith("'"));

    if (isStaticString) {
      const staticValue = valueStr.slice(1, -1);
      attrs.push(`${key}="${staticValue}"`);
    } else {
      const transformedValue = transformTemplateExpression(valueStr, ctx);
      attrs.push(vueDynamicAttr(`:${key}`, transformedValue));
    }
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      const eventName = attr.name.slice(3);
      const handler = transformTemplateExpression(attr.value, ctx);
      const vueModifiers = attr.modifiers && attr.modifiers.length > 0
        ? '.' + attr.modifiers.map((mod: string) => {
            switch (mod) {
              case 'preventDefault': return 'prevent';
              case 'stopPropagation': return 'stop';
              case 'stopImmediatePropagation': return 'stop';
              default: return mod;
            }
          }).join('.')
        : '';
      attrs.push(vueDynamicAttr(`@${eventName}${vueModifiers}`, handler));
    } else if (attr.name.startsWith('bind:')) {
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');
      if (propName === 'value' || propName === 'checked') {
        attrs.push(`v-model="${varName}"`);
      } else if (propName === 'this') {
        attrs.push(`ref="${varName}"`);
      } else {
        attrs.push(`v-model:${propName}="${varName}"`);
      }
    } else if (attr.name.startsWith('class:')) {
      const className = attr.name.slice(6);
      const condition = transformTemplateExpression(attr.value, ctx);
      attrs.push(vueDynamicAttr(':class', `{ '${className}': ${condition} }`));
    } else {
      attrs.push(vueAttr(attr.name, attr.value, ctx));
    }
  }

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<component${attrsStr} />`;
  }

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenHTML.trim()) {
    return `<component${attrsStr} />`;
  }

  const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;

  if (hasMultipleLines) {
    return `<component${attrsStr}>\n${indent(childrenHTML)}\n</component>`;
  } else {
    return `<component${attrsStr}>${childrenHTML}</component>`;
  }
}

/**
 * Generate dce:window (window event handlers)
 */
function generateDceWindow(node: any, ctx: GeneratorContext): string {
  // Vue doesn't have a built-in window directive
  // We need to use onMounted/onUnmounted in the script
  // For now, return empty string as this needs script-level handling
  // TODO: Refactor to properly inject window event handlers
  return '';
}

/**
 * Generate dce:boundary (error boundary)
 */
function generateDceBoundary(node: any, ctx: GeneratorContext, depth: number): string {
  // Vue 3 has onErrorCaptured hook for error boundaries
  // Wrap children in a component with error handling
  const { children = [], attributes = [] } = node;

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  // Find the onerror handler if specified
  let onError = 'console.error';
  for (const attr of attributes) {
    if (attr.name === 'onerror') {
      onError = transformTemplateExpression(attr.value, ctx);
    }
  }

  // Vue doesn't have a built-in ErrorBoundary component
  // Users would need to create a wrapper component
  return `<ErrorBoundary ${vueDynamicAttr(':on-error', onError)}>\n${indent(childrenHTML)}\n</ErrorBoundary>`;
}

/**
 * Generate dce:head (document head)
 */
function generateDceHead(node: any, ctx: GeneratorContext, depth: number): string {
  // Vue uses @vueuse/head or similar libraries for head management
  // Generate using Teleport to head
  const { children = [] } = node;

  const childrenHTML = children
    .map((child: any) => generateTemplate(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `<Teleport to="head">\n${indent(childrenHTML)}\n</Teleport>`;
}


/**
 * A per-item behavior effect compiles to a custom directive, so the name has
 * to be a `vFoo` binding for `<script setup>` to pick it up as `v-foo`.
 */
function scopedDirectiveName(scoped: ScopedBehavior): string {
  return `vDce${scoped.scope.id.replace(/[^\w]/g, '_')}`;
}

/** The template-side spelling of the directive, e.g. `v-dce-timer-0`. */
function scopedDirectiveTag(scoped: ScopedBehavior): string {
  return `v-${scopedDirectiveName(scoped)
    .replace(/^v/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()}`;
}

/**
 * Render the placeholder a behavior primitive leaves in the template.
 *
 * Component-level effects render nothing. One captured inside an {#each}
 * attaches its generated directive to a zero-size element inside the loop
 * body, so the effect runs once per item and tears down with that item.
 */
function generateDceBehavior(node: any, ctx: GeneratorContext): string {
  const scoped = scopedFor(ctx.scopedBehaviors, node.scope);
  if (!scoped) return '';

  const binding = `[${scoped.props.join(', ')}]`;
  const directive = vueDynamicAttr(scopedDirectiveTag(scoped), binding);

  // `display: contents` keeps the host element out of layout.
  return `<span style="display: contents" ${directive}></span>`;
}

/**
 * Emit one custom directive per behavior effect captured inside an {#each}.
 *
 * A Vue SFC is a single file, so a per-item child component is not available.
 * A directive is the equivalent: `mounted` runs when its element is created
 * with the loop bindings as the binding value, and `unmounted` runs when that
 * one item leaves the list.
 */
function generateScopedBehaviorDirectives(
  ir: DurableComponentIR,
  ctx: GeneratorContext
): string {
  const { scoped } = partitionLifecycle(ir);
  if (scoped.length === 0) return '';

  for (const helper of behaviorsUsedBy(scoped.map((entry) => entry.effect))) {
    ctx.usedBehaviors.add(helper);
  }

  return scoped
    .map((entry) => {
      const { effect, props } = entry;
      const name = scopedDirectiveName(entry);
      const store = '__dceNode.__dceDestroy';

      // The binding value carries the loop scope; unpacking it here keeps the
      // emitted setup expression identical to every other target's.
      const unpack = `const [${props.join(', ')}] = __dceBinding.value;`;
      const setup = effect.teardown
        ? `${effect.setup};\n${store} = () => ${effect.teardown};`
        : `${store} = ${effect.setup};`;

      return `const ${name} = {\n${indent(
        `mounted(__dceNode, __dceBinding) {\n${indent(
          `${unpack}\n${setup}`
        )}\n},\nunmounted(__dceNode) {\n${indent(
          `if (typeof ${store} === 'function') ${store}();`
        )}\n}`
      )}\n};`;
    })
    .join('\n\n');
}
