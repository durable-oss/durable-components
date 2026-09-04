/**
 * SolidJS Generator
 *
 * Transforms the canonical IR into a SolidJS functional component using Solid primitives.
 * This implements the mapping from IR to SolidJS reactive primitives.
 */

import type { DurableComponentIR, TemplateNode } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
import { indent, joinStatements } from '../utils/code-gen';
import { generateModifierWrapper } from '../utils/event-modifiers';
import { arrowBody } from '../utils/arrow-body';
import { returnsTeardown } from '../utils/effect-cleanup';
import {
  behaviorHelperSource,
  behaviorsUsedBy,
  type BehaviorHelper
} from './behavior-runtime';

interface GeneratorContext {
  /** Track used Solid primitives for imports */
  usedPrimitives: Set<string>;
  /** Track state getters for signal access */
  stateGetters: Map<string, string>;
  /** Track state setters for reference */
  stateSetters: Map<string, string>;
  /** Track derived values (memos) */
  derivedNames: Set<string>;
  /** Behavior helpers the emitted lifecycle effects call */
  usedBehaviors: Set<BehaviorHelper>;
  /** Component name */
  componentName: string;
}

/**
 * Generate SolidJS component from IR
 */
export function generateSolid(ir: DurableComponentIR): CompiledJS {
  const ctx: GeneratorContext = {
    usedPrimitives: new Set(),
    stateGetters: new Map(),
    stateSetters: new Map(),
    derivedNames: new Set(),
    usedBehaviors: new Set(),
    componentName: ir.name
  };

  // Generate component body
  const externalImports = generateExternalImports(ir);
  const types = generateTypes(ir);
  const propsInterface = generatePropsInterface(ir);
  const component = generateComponent(ir, ctx);

  // Generate Solid imports
  const solidImports = generateSolidImports(ctx);

  // Combine all parts
  const behaviorHelpers = behaviorHelperSource(ctx.usedBehaviors);
  const code = joinStatements(
    solidImports,
    externalImports,
    types,
    propsInterface,
    behaviorHelpers,
    component
  );

  return {
    code
  };
}

/**
 * Components Solid exports from `solid-js/web` rather than the package root.
 * Importing these from `solid-js` yields undefined at runtime.
 */
const WEB_ONLY_PRIMITIVES = new Set(['Dynamic', 'Portal']);

/**
 * Generate Solid imports based on used primitives.
 *
 * Reactive primitives and control-flow components come from `solid-js`; the
 * DOM-specific components in `WEB_ONLY_PRIMITIVES` come from `solid-js/web`.
 */
function generateSolidImports(ctx: GeneratorContext): string {
  if (ctx.usedPrimitives.size === 0) {
    return '';
  }

  const primitives = Array.from(ctx.usedPrimitives).sort();
  const core = primitives.filter((name) => !WEB_ONLY_PRIMITIVES.has(name));
  const web = primitives.filter((name) => WEB_ONLY_PRIMITIVES.has(name));

  const imports: string[] = [];
  if (core.length > 0) {
    imports.push(`import { ${core.join(', ')} } from 'solid-js';`);
  }
  if (web.length > 0) {
    imports.push(`import { ${web.join(', ')} } from 'solid-js/web';`);
  }

  return imports.join('\n');
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
 * Generate TypeScript props interface
 */
function generatePropsInterface(ir: DurableComponentIR): string {
  if (ir.props.length === 0) return '';

  const props = ir.props.map((prop) => {
    const optional = prop.defaultValue ? '?' : '';
    const type = prop.type || 'any';
    return `  ${prop.name}${optional}: ${type};`;
  });

  return `interface ${ir.name}Props {\n${props.join('\n')}\n}`;
}

/**
 * Generate component function
 */
function generateComponent(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const hasProps = ir.props.length > 0;
  const propsParam = hasProps ? `props: ${ir.name}Props` : '';

  const body: string[] = [];

  // Destructure props with defaults
  if (ir.props.length > 0) {
    const destructure = generatePropsDestructure(ir);
    body.push(destructure);
  }

  // Generate state declarations (createSignal)
  if (ir.state.length > 0) {
    ctx.usedPrimitives.add('createSignal');
    body.push(generateStateDeclarations(ir, ctx));
  }

  // Generate element refs (SolidJS uses simple let declarations)
  if (ir.refs && ir.refs.length > 0) {
    body.push(generateRefDeclarations(ir, ctx));
  }

  // Generate derived/computed values (createMemo)
  if (ir.derived.length > 0) {
    ctx.usedPrimitives.add('createMemo');
    body.push(generateDerivedDeclarations(ir, ctx));
  }

  // Generate effects (createEffect)
  if (ir.effects.length > 0) {
    ctx.usedPrimitives.add('createEffect');
    body.push(generateEffectDeclarations(ir, ctx));
  }

  // Generate functions
  if (ir.functions.length > 0) {
    body.push(generateFunctionDeclarations(ir, ctx));
  }

  // Generate mount/unmount effects from the dce:* behavior primitives. These
  // come after the function declarations because a primitive's handler is
  // usually one of them, and the emitted functions are `const` — referencing
  // one earlier would hit the temporal dead zone.
  const lifecycleDeclarations = generateLifecycleDeclarations(ir, ctx);
  if (lifecycleDeclarations) {
    body.push(lifecycleDeclarations);
  }

  // Generate JSX return — wrap in fragment if root is not an element
  const jsx = generateJSX(ir.template, ctx);
  const needsFragment = !jsx.trimStart().startsWith('<');
  const returnJsx = needsFragment ? `<>\n${indent(jsx)}\n</>` : jsx;
  body.push(`return (\n${indent(returnJsx)}\n);`);

  const componentBody = body.join('\n\n');

  return `export function ${ir.name}(${propsParam}) {\n${indent(componentBody)}\n}`;
}

/**
 * Generate props destructuring with defaults
 */
function generatePropsDestructure(ir: DurableComponentIR): string {
  const propsList = ir.props.map((prop) => {
    if (prop.defaultValue) {
      return `${prop.name} = ${prop.defaultValue}`;
    }
    return prop.name;
  });

  return `const { ${propsList.join(', ')} } = props;`;
}

/**
 * Generate createSignal declarations
 */
function generateStateDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.state.map((state) => {
    const setterName = `set${capitalize(state.name)}`;
    ctx.stateGetters.set(state.name, state.name);
    ctx.stateSetters.set(state.name, setterName);

    // Replace prop references in initial value
    let initialValue = state.initialValue;
    for (const prop of ir.props) {
      initialValue = initialValue.replace(
        new RegExp(`\\bprops\\.${prop.name}\\b`, 'g'),
        prop.name
      );
    }

    return `const [${state.name}, ${setterName}] = createSignal(${initialValue});`;
  });

  return declarations.join('\n');
}

/**
 * Generate ref declarations (SolidJS uses simple let declarations)
 */
function generateRefDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  if (!ir.refs || ir.refs.length === 0) return '';

  const declarations = ir.refs.map((ref) => {
    return `let ${ref.name};`;
  });

  return declarations.join('\n');
}

/**
 * Generate createMemo declarations for derived values
 */
function generateDerivedDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.derived.map((derived) => {
    // Track derived names for JSX transformation
    ctx.derivedNames.add(derived.name);

    const expr = transformExpression(derived.expression, ir, ctx);
    // SolidJS doesn't need dependency arrays - it auto-tracks

    return `const ${derived.name} = createMemo(() => ${arrowBody(expr)});`;
  });

  return declarations.join('\n');
}

/**
 * Generate the mount/unmount effects contributed by the dce:* primitives.
 *
 * Solid runs these once via onMount and registers the teardown with onCleanup,
 * which is how it models unmount — a value returned from the callback is
 * discarded.
 */
function generateLifecycleDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const lifecycle = ir.lifecycle ?? [];
  if (lifecycle.length === 0) return '';

  ctx.usedPrimitives.add('onMount');
  ctx.usedPrimitives.add('onCleanup');
  for (const helper of behaviorsUsedBy(lifecycle)) {
    ctx.usedBehaviors.add(helper);
  }

  return lifecycle
    .map((effect) => {
      // With no explicit teardown the helper's own return value is the
      // teardown, so the setup call is passed straight to onCleanup.
      const setup = effect.teardown
        ? `${effect.setup};\nonCleanup(() => ${effect.teardown});`
        : `onCleanup(${effect.setup});`;

      return `onMount(() => {\n${indent(setup)}\n});`;
    })
    .join('\n');
}

/**
 * Generate createEffect declarations
 */
function generateEffectDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.effects.map((effect) => {
    // Assignments to state have to become setter calls here too, not just in
    // function bodies — an effect that writes state is ordinary DSL code.
    const expr = applySetterTransforms(effect.expression, ir, ctx);
    // SolidJS doesn't need dependency arrays - it auto-tracks

    // Handle block vs expression
    const effectBody = expr.startsWith('{') ? expr : `{\n${indent(expr)}\n}`;

    // Solid discards a value returned from createEffect, so a teardown has to
    // be registered with onCleanup instead. Without this every listener, timer,
    // and observer an effect sets up leaks on unmount.
    if (returnsTeardown(effect.expression)) {
      ctx.usedPrimitives.add('onCleanup');
      return `createEffect(() => {\n${indent(
        `const __cleanup = (() => ${effectBody})();\nif (typeof __cleanup === 'function') onCleanup(__cleanup);`
      )}\n});`;
    }

    return `createEffect(() => ${effectBody});`;
  });

  return declarations.join('\n');
}

/**
 * The compound assignment operators, longest first so that alternation matches
 * `>>>` before `>>` and `**` before `*`. Kept out of the plain-assignment path,
 * which only handles `=`.
 */
const COMPOUND_ASSIGNMENT_OPERATORS = '>>>|\\*\\*|<<|>>|&&|\\|\\||\\?\\?|[+\\-*/%&|^]';

/**
 * Rewrite assignments to state as signal setter calls.
 *
 * Solid signals are read through a getter and written through a setter, so
 * `count = 1` has to become `setCount(1)`. This was applied only to function
 * bodies, so an assignment inside an effect — including one nested in a
 * callback the effect registers — survived to the accessor pass and came out
 * as `count() = 1`, which is not a valid assignment target.
 */
function applySetterTransforms(
  body: string,
  ir: DurableComponentIR,
  ctx: GeneratorContext
): string {
  for (const state of ir.state) {
    const getter = state.name;
    const setter = ctx.stateSetters.get(state.name);
    if (setter) {
      // Replace count++ with setCount(count() + 1)
      body = body.replace(
        new RegExp(`\\b${state.name}\\+\\+`, 'g'),
        `${setter}(${getter}() + 1)`
      );
      body = body.replace(
        new RegExp(`\\b${state.name}--`, 'g'),
        `${setter}(${getter}() - 1)`
      );
      // Replace `count += value` with `setCount(count() + value)`. This has to
      // run before the plain-assignment rule below, which would otherwise not
      // match at all: the operator would survive to the accessor pass and come
      // out as `count() += value`, which is not a valid assignment target.
      body = body.replace(
        new RegExp(`\\b${state.name}\\s*(${COMPOUND_ASSIGNMENT_OPERATORS})=\\s*([^;]+);`, 'g'),
        (_match, op, value) => {
          let transformedValue = String(value).trim();
          for (const s2 of ir.state) {
            transformedValue = transformedValue.replace(
              new RegExp(`\\b${s2.name}(?!\\()\\b`, 'g'),
              `${s2.name}()`
            );
          }
          return `${setter}(${getter}() ${op} ${transformedValue});`;
        }
      );
      // Replace count = value with setCount(value)
      // Need to be careful to handle expressions that might contain state values
      body = body.replace(
        new RegExp(`\\b${state.name}\\s*=\\s*([^=].+?);`, 'g'),
        (match, value) => {
          // Transform state references in the value to use getters
          let transformedValue = value;
          for (const s of ir.state) {
            transformedValue = transformedValue.replace(
              new RegExp(`\\b${s.name}\\b`, 'g'),
              `${s.name}()`
            );
          }
          return `${setter}(${transformedValue});`;
        }
      );
    }
  }

  // Transform remaining state references to use signal getters
  for (const state of ir.state) {
    // Only replace if it's not already followed by () or being used in a setter
    body = body.replace(
      new RegExp(`\\b${state.name}(?!\\()\\b`, 'g'),
      `${state.name}()`
    );
  }

  return body;
}

/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.functions.map((func) => {
    const params = func.params?.join(', ') || '';
    const body = applySetterTransforms(func.body, ir, ctx);

    // Handle block vs expression body
    const functionBody = body.startsWith('{') ? body : `{\n${indent(body)}\n}`;
    const asyncPrefix = func.async ? 'async ' : '';

    return `const ${func.name} = ${asyncPrefix}(${params}) => ${functionBody};`;
  });

  return declarations.join('\n\n');
}

/**
 * Generate JSX from template IR
 */
function generateJSX(node: TemplateNode, ctx: GeneratorContext, depth: number = 0): string {
  switch (node.type) {
    case 'element':
      return generateElementJSX(node, ctx, depth);

    case 'text':
      return node.content.trim() ? node.content : '';

    case 'expression':
      // For expressions, we need to pass the IR to transform derived values properly
      return `{${transformExpressionInJSX(node.expression, ctx)}}`;

    case 'if':
      return generateIfJSX(node, ctx, depth);

    case 'each':
      return generateEachJSX(node, ctx, depth);

    case 'slot':
      return generateSlotJSX(node, ctx, depth);

    case 'render':
      return generateRenderJSX(node, ctx);

    case 'comment':
      return `{/* ${node.content} */}`;

    case 'dce-behavior':
      // Behavior primitives contribute a lifecycle effect, not markup.
      return '';

    case 'dce-element':
      return generateDceElementJSX(node, ctx, depth);

    case 'dce-window':
      return generateDceWindowJSX(node, ctx);

    case 'dce-boundary':
      return generateDceBoundaryJSX(node, ctx, depth);

    case 'dce-head':
      return generateDceHeadJSX(node, ctx, depth);

    default:
      return '';
  }
}

/**
 * Generate element JSX
 */
function generateElementJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  const { name, attributes = [], bindings = {}, children = [] } = node;

  // The template parser has no dedicated Slot AST node, so `<slot />` and
  // `<slot name="header">` arrive here as ordinary elements. A literal
  // `<slot>` tag is not valid JSX, so route it through the slot generator.
  if (name === 'slot') {
    return generateSlotJSX(slotNodeFromElement(node), ctx, depth);
  }

  // Collect all props
  const props: string[] = [];

  // Handle bindings
  for (const [key, value] of Object.entries(bindings)) {
    const valueStr = String(value);
    if (key === 'class') {
      props.push(`className={${transformExpression(valueStr, {} as any, ctx)}}`);
    } else {
      props.push(`${key}={${transformExpression(valueStr, {} as any, ctx)}}`);
    }
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      // Event handler: on:click -> onClick
      const eventName = 'on' + capitalize(attr.name.slice(3));
      const handler = attr.value.replace('functions.', '');

      // Handle event modifiers (Solid doesn't have native modifier support)
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;

      props.push(`${eventName}={${finalHandler}}`);
    } else if (attr.name === 'bind:this') {
      // Element reference: bind:this={element} -> ref={element}
      const varName = attr.value.replace('state.', '');
      props.push(`ref={${varName}}`);
    } else if (attr.name.startsWith('bind:')) {
      // Two-way binding: bind:value
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');
      const setter = ctx.stateSetters.get(varName);

      // In SolidJS, signals are accessed as functions
      props.push(`${propName}={${varName}()}`);
      if (setter) {
        // SolidJS uses onInput for controlled inputs and e.currentTarget
        if (propName === 'value') {
          props.push(`onInput={(e) => ${setter}(e.currentTarget.value)}`);
        } else {
          props.push(`onChange={(e) => ${setter}(e.currentTarget.value)}`);
        }
      }
    } else if (attr.name.startsWith('class:')) {
      // Class directive: class:active={isActive}
      // For now, skip these (would need className logic)
    } else {
      // Regular attribute. Ordinary elements route these through `bindings`,
      // but dce:* elements put them here, so without this branch they were
      // silently dropped.
      props.push(solidAttrProp(attr.name, attr.value, ctx));
    }
  }

  const propsStr = props.length > 0 ? ' ' + props.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<${name}${propsStr} />`;
  }

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenJSX.trim()) {
    return `<${name}${propsStr} />`;
  }

  return `<${name}${propsStr}>\n${indent(childrenJSX)}\n</${name}>`;
}

/**
 * Generate if statement JSX (using Show component for better optimization)
 */
function generateIfJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const condition = transformExpression(node.condition, {} as any, ctx);
  const consequent = wrapJsxChildren(
    node.consequent.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
  );

  if (!node.alternate || node.alternate.length === 0) {
    // SolidJS idiom: use && for simple conditionals
    return `{${condition} && (\n${indent(consequent)}\n)}`;
  }

  // SolidJS idiom: use ternary for if/else, flattening {:else if} chains
  return `{${condition} ? (\n${indent(consequent)}\n) : ${generateElseBranch(node.alternate, ctx, depth)}}`;
}

/**
 * Render the else branch, collapsing a single nested IfNode ({:else if}) into a
 * flat ternary cascade rather than a nested child block.
 */
function generateElseBranch(alternate: any[], ctx: GeneratorContext, depth: number): string {
  if (alternate.length === 1 && alternate[0].type === 'if') {
    const elseIf = alternate[0];
    const condition = transformExpression(elseIf.condition, {} as any, ctx);
    const consequent = wrapJsxChildren(
      elseIf.consequent.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
    );

    if (!elseIf.alternate || elseIf.alternate.length === 0) {
      return `${condition} ? (\n${indent(consequent)}\n) : null`;
    }

    return `${condition} ? (\n${indent(consequent)}\n) : ${generateElseBranch(elseIf.alternate, ctx, depth)}`;
  }

  const alternateJsx = wrapJsxChildren(
    alternate.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
  );
  return `(\n${indent(alternateJsx)}\n)`;
}

/** Access a named-slot prop by dot when the name is a valid identifier, else by index. */
function propAccess(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
    ? `.${name}`
    : `[${JSON.stringify(name)}]`;
}

/**
 * Read the slot name off an element-shaped `<slot>` node.
 *
 * The name can arrive as a static attribute (`<slot name="header" />`) or, for
 * a dynamic name, as a binding. Only a static string identifies a named slot;
 * anything else falls back to the default slot.
 */
function slotNodeFromElement(node: any): { type: 'slot'; name?: string; fallback: any[] } {
  // A static name lands in bindings as a quoted string ("header"); a name
  // written as a plain HTML attribute lands in attributes instead.
  const bound = node.bindings ? node.bindings.name : undefined;
  const nameAttr = (node.attributes || []).find((attr: any) => attr.name === 'name');
  const raw = bound !== undefined ? String(bound) : nameAttr ? String(nameAttr.value) : undefined;

  // Only a static string names a slot. A dynamic name (a bare expression) has
  // no compile-time prop to map to, so treat it as the default slot.
  const isStatic = raw !== undefined && /^(["']).*\1$/.test(raw);
  const name = isStatic ? raw!.slice(1, -1) : undefined;

  return {
    type: 'slot',
    name: name || undefined,
    fallback: node.children || []
  };
}

/**
 * Generate JSX for a slot.
 *
 * Solid has no slot element. The default slot is `props.children`; a named slot
 * is passed as a prop of that name. Fallback content renders when the consumer
 * supplies nothing, which is `??` rather than `||` so that a legitimately falsy
 * child (0, '') is still rendered.
 */
function generateSlotJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const source = node.name ? `props${propAccess(node.name)}` : 'props.children';
  const fallback = node.fallback || node.children || [];

  // A lone fallback child lands directly to the right of `??`, in expression
  // position. Several children are wrapped in a fragment first, which puts each
  // one back in ordinary child position.
  const meaningful = fallback.filter((child: any) => !isEmptyFallbackChild(child));

  if (meaningful.length === 0) {
    return `{${source}}`;
  }

  if (meaningful.length === 1) {
    return `{${source} ?? ${generateSlotFallbackExpression(meaningful[0], ctx, depth + 1)}}`;
  }

  const childrenJSX = meaningful
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean);

  return `{${source} ?? ${wrapJsxChildren(childrenJSX)}}`;
}

/** A fallback child that contributes nothing, such as whitespace between tags. */
function isEmptyFallbackChild(node: any): boolean {
  return node.type === 'text' && !node.content.trim();
}

/**
 * Generate one fallback child in expression position.
 *
 * Child-position JSX is not an expression: bare text is not a string literal,
 * and `generateJSX` wraps expressions, conditionals and loops in the braces of
 * a JSX expression container. To the right of `??` those braces would read as
 * an object literal, so build the expression form directly instead.
 */
function generateSlotFallbackExpression(node: any, ctx: GeneratorContext, depth: number): string {
  if (node.type === 'text') {
    return JSON.stringify(node.content.trim());
  }

  if (node.type === 'expression') {
    return transformExpressionInJSX(node.expression, ctx);
  }

  if (node.type === 'if') {
    // `??` binds tighter than both `&&` and `?:`, so an unparenthesized
    // conditional would regroup as `(props.x ?? cond) && (...)`.
    return parenthesize(stripJsxBraces(generateIfJSX(node, ctx, depth)));
  }

  if (node.type === 'each') {
    return stripJsxBraces(generateEachJSX(node, ctx, depth));
  }

  // Anything else (an element, a component) already generates as a bare JSX
  // element, which is a valid expression as it stands.
  return generateJSX(node, ctx, depth);
}

/**
 * Unwrap the outer braces of a JSX expression container so the expression can
 * be used on its own. Only strips when the whole string is one container; a
 * value such as `{a} {b}` is left alone, since its braces do not pair up
 * across the string.
 */
function stripJsxBraces(jsx: string): string {
  const trimmed = jsx.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return trimmed;
  }

  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      depth++;
    } else if (trimmed[i] === '}') {
      depth--;
      // The opening brace closed before the end, so the string is a sequence of
      // containers rather than a single one.
      if (depth === 0 && i < trimmed.length - 1) {
        return trimmed;
      }
    }
  }

  return depth === 0 ? trimmed.slice(1, -1).trim() : trimmed;
}

/**
 * Wrap an expression in parentheses so it survives being placed to the right of
 * `??`, which binds tighter than the `&&` and `?:` that conditionals generate.
 */
function parenthesize(expr: string): string {
  return `(\n${indent(expr)}\n)`;
}

/**
 * Join sibling JSX children, wrapping in a fragment when there is more than one.
 */
function wrapJsxChildren(children: string[]): string {
  const joined = children.join('\n');
  if (children.length <= 1) {
    return joined;
  }
  return `<>\n${indent(joined)}\n</>`;
}

/**
 * Generate each loop JSX (using For component would be better, but .map works)
 */
function generateEachJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const array = transformExpression(node.expression, {} as any, ctx);
  const item = node.itemName;
  const index = node.indexName || 'index';
  const key = node.key ? transformExpression(node.key, {} as any, ctx) : index;

  const renderedChildren = node.children
    .map((child: any) => {
      // Replace item references in children
      let jsx = generateJSX(child, ctx, depth + 1);
      // Add key prop to first child element if key is specified
      if (node.key && child.type === 'element') {
        // Insert key prop into the first element
        jsx = jsx.replace(/^(\s*<\w+)/, `$1 key={${key}}`);
      }
      return jsx;
    })
    .filter(Boolean);

  const body = eachReturnBody(renderedChildren);

  // SolidJS .map() works well for simple cases
  return `{${array}.map((${item}, ${index}) => (\n${indent(body)}\n))}`;
}

/**
 * Build the JSX a `.map()` callback returns. A single conditional/expression
 * child is already `{...}`; unwrap it so the arrow doesn't read `( {expr} )` as
 * an object literal. Multiple children are wrapped in a fragment.
 */
function eachReturnBody(children: string[]): string {
  if (children.length === 1) {
    return stripJsxBraces(children[0]);
  }
  return `<>\n${indent(children.join('\n'))}\n</>`;
}

/**
 * Generate render block JSX (for {@render snippet()} syntax)
 * Always generates defensive code that safely handles undefined snippets
 */
function generateRenderJSX(node: any, ctx: GeneratorContext): string {
  const snippet = node.snippet;
  const args = node.args || [];
  const argsList = args.length > 0 ? args.join(', ') : '';

  // Always generate defensive code with optional chaining
  return `{${snippet}?.(${argsList})}`;
}

/**
 * Transform IR expression to SolidJS JavaScript (for use in JSX)
 */
function transformExpressionInJSX(expr: string, ctx: GeneratorContext): string {
  // Remove IR prefixes (state., props., derived., functions.)
  let transformed = expr;

  // First remove the prefixes
  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, '');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  // Then add signal accessors for state variables
  // We need to be careful to only add () where needed
  if (ctx.stateGetters) {
    for (const [stateName] of ctx.stateGetters) {
      // Replace state name with state() accessor, but only if not already followed by ()
      transformed = transformed.replace(
        new RegExp(`\\b${stateName}(?!\\()\\b`, 'g'),
        `${stateName}()`
      );
    }
  }

  // Add accessors for derived values (memos also need to be called)
  if (ctx.derivedNames) {
    for (const derivedName of ctx.derivedNames) {
      transformed = transformed.replace(
        new RegExp(`\\b${derivedName}(?!\\()\\b`, 'g'),
        `${derivedName}()`
      );
    }
  }

  return transformed;
}

/**
 * Transform IR expression to SolidJS JavaScript
 */
function transformExpression(expr: string, ir: DurableComponentIR, ctx: GeneratorContext): string {
  // Remove IR prefixes (state., props., derived., functions.)
  let transformed = expr;

  // First remove the prefixes
  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, '');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  // Then add signal accessors for state variables
  // We need to be careful to only add () where needed
  if (ctx.stateGetters) {
    for (const [stateName] of ctx.stateGetters) {
      // Replace state name with state() accessor, but only if not already followed by ()
      transformed = transformed.replace(
        new RegExp(`\\b${stateName}(?!\\()\\b`, 'g'),
        `${stateName}()`
      );
    }
  }

  // Similarly for derived values (they are also memos which need to be called)
  if (ir.derived) {
    for (const derived of ir.derived) {
      transformed = transformed.replace(
        new RegExp(`\\b${derived.name}(?!\\()\\b`, 'g'),
        `${derived.name}()`
      );
    }
  }

  return transformed;
}

/**
 * Emit a regular (non-directive) attribute as a Solid JSX prop.
 *
 * A quoted literal stays a JSX string attribute; anything else is an
 * expression and goes in braces, with IR prefixes and signal accessors applied.
 */
function solidAttrProp(name: string, rawValue: string, ctx: GeneratorContext): string {
  const attrName = name === 'class' ? 'className' : name;
  const value = String(rawValue ?? '');

  if (/^["'][\s\S]*["']$/.test(value)) {
    return `${attrName}=${value}`;
  }

  return `${attrName}={${transformExpression(value, {} as any, ctx)}}`;
}

/**
 * Generate dce:element JSX (dynamic component)
 */
function generateDceElementJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  ctx.usedPrimitives.add('Dynamic');

  const { tagExpression, attributes = [], bindings = {}, children = [] } = node;

  // Transform the tag expression
  const component = transformExpression(tagExpression, {} as any, ctx);

  // Collect all props
  const props: string[] = [];

  // SolidJS uses Dynamic component for dynamic elements
  props.push(`component={${component}}`);

  // Handle bindings
  for (const [key, value] of Object.entries(bindings)) {
    const valueStr = String(value);
    if (key === 'class') {
      props.push(`className={${transformExpression(valueStr, {} as any, ctx)}}`);
    } else {
      props.push(`${key}={${transformExpression(valueStr, {} as any, ctx)}}`);
    }
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      const eventName = 'on' + capitalize(attr.name.slice(3));
      const handler = attr.value.replace('functions.', '');
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;
      props.push(`${eventName}={${finalHandler}}`);
    } else if (attr.name.startsWith('bind:')) {
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');
      const setter = ctx.stateSetters.get(varName);
      props.push(`${propName}={${varName}()}`);
      if (setter && propName === 'value') {
        props.push(`onInput={(e) => ${setter}(e.currentTarget.value)}`);
      }
    } else {
      props.push(solidAttrProp(attr.name, attr.value, ctx));
    }
  }

  const propsStr = props.length > 0 ? ' ' + props.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<Dynamic${propsStr} />`;
  }

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenJSX.trim()) {
    return `<Dynamic${propsStr} />`;
  }

  return `<Dynamic${propsStr}>\n${indent(childrenJSX)}\n</Dynamic>`;
}

/**
 * Generate dce:window JSX (window event handlers)
 */
function generateDceWindowJSX(node: any, ctx: GeneratorContext): string {
  // SolidJS doesn't have a built-in window directive
  // We need to use onMount/onCleanup to set up window event listeners
  // For now, return empty string as this needs script-level handling
  // TODO: Refactor to properly inject window event handlers
  return '';
}

/**
 * Generate dce:boundary JSX (error boundary)
 */
function generateDceBoundaryJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  ctx.usedPrimitives.add('ErrorBoundary');

  const { children = [], attributes = [] } = node;

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  // Find the onerror handler if specified
  let fallback = 'err => <div>Error: {err.message}</div>';
  for (const attr of attributes) {
    if (attr.name === 'onerror') {
      const handler = attr.value.replace('functions.', '');
      fallback = `err => { ${handler}(err); return <div>Error occurred</div>; }`;
    }
  }

  return `<ErrorBoundary fallback={${fallback}}>\n${indent(childrenJSX)}\n</ErrorBoundary>`;
}

/**
 * Generate dce:head JSX (document head)
 */
function generateDceHeadJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  // SolidJS uses solid-meta or @solidjs/meta for head management
  // Generate using Portal to head
  ctx.usedPrimitives.add('Portal');

  const { children = [] } = node;

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `<Portal mount={document.head}>\n${indent(childrenJSX)}\n</Portal>`;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
