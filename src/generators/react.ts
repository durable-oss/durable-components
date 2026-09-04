/**
 * React Generator
 *
 * Transforms the canonical IR into a React functional component using Hooks.
 * This implements the mapping defined in Table 3 of the architectural plan.
 */

import type { DurableComponentIR, TemplateNode } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
import { indent, joinStatements, objectLiteral } from '../utils/code-gen';
import { generateModifierWrapper } from '../utils/event-modifiers';
import { arrowBody } from '../utils/arrow-body';
import {
  STYLE_HELPER_NAME,
  STYLE_HELPER_SOURCE,
  parseStaticStyle
} from '../utils/css-style';

interface GeneratorContext {
  /** Track used hooks for imports */
  usedHooks: Set<string>;
  /** Track state setters for reference */
  stateSetters: Map<string, string>;
  /** Set when a dynamic `style` prop needs the CSS-string-to-object helper */
  usesStyleHelper: boolean;
  /** Capitalized aliases for `<dce:element>` tag expressions, in emit order */
  dynamicTags: Map<string, string>;
  /** Component name */
  componentName: string;
}

/**
 * Generate React component from IR
 */
export function generateReact(ir: DurableComponentIR): CompiledJS {
  const ctx: GeneratorContext = {
    usedHooks: new Set(),
    stateSetters: new Map(),
    usesStyleHelper: false,
    dynamicTags: new Map(),
    componentName: ir.name
  };

  // Generate component body
  const externalImports = generateExternalImports(ir);
  const types = generateTypes(ir);
  const propsInterface = generatePropsInterface(ir);
  const component = generateComponent(ir, ctx);

  // Generate React imports
  const reactImports = generateReactImports(ctx);

  // The style helper is only emitted when a dynamic `style` prop needs it;
  // `ctx.usesStyleHelper` is set while the component body is generated above.
  const styleHelper = ctx.usesStyleHelper ? STYLE_HELPER_SOURCE : '';

  // Combine all parts
  const code = joinStatements(
    reactImports,
    externalImports,
    types,
    propsInterface,
    styleHelper,
    component
  );

  return {
    code
  };
}

/**
 * Generate React imports based on used hooks
 */
function generateReactImports(ctx: GeneratorContext): string {
  if (ctx.usedHooks.size === 0) {
    return "import React from 'react';";
  }

  const hooks = Array.from(ctx.usedHooks).sort();
  return `import React, { ${hooks.join(', ')} } from 'react';`;
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

  // Generate state declarations
  if (ir.state.length > 0) {
    ctx.usedHooks.add('useState');
    body.push(generateStateDeclarations(ir, ctx));
  }

  // Generate element refs
  if (ir.refs && ir.refs.length > 0) {
    ctx.usedHooks.add('useRef');
    body.push(generateRefDeclarations(ir, ctx));
  }

  // Generate derived/computed values
  if (ir.derived.length > 0) {
    ctx.usedHooks.add('useMemo');
    body.push(generateDerivedDeclarations(ir, ctx));
  }

  // Generate effects
  if (ir.effects.length > 0) {
    ctx.usedHooks.add('useEffect');
    body.push(generateEffectDeclarations(ir, ctx));
  }

  // Generate functions
  if (ir.functions.length > 0) {
    body.push(generateFunctionDeclarations(ir, ctx));
  }

  // Generate JSX return — wrap in fragment if root is not an element
  const jsx = generateJSX(ir.template, ctx);

  // `<dce:element>` tag aliases are discovered while generating the JSX above,
  // so their declarations are appended once that is done — still ahead of the
  // return statement pushed below.
  if (ctx.dynamicTags.size > 0) {
    body.push(
      Array.from(ctx.dynamicTags)
        .map(([expression, alias]) => `const ${alias} = ${expression};`)
        .join('\n')
    );
  }

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
 * Generate useState declarations
 */
function generateStateDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.state.map((state) => {
    const setterName = `set${capitalize(state.name)}`;
    ctx.stateSetters.set(state.name, setterName);

    // Replace prop references in initial value
    let initialValue = state.initialValue;
    for (const prop of ir.props) {
      initialValue = initialValue.replace(
        new RegExp(`\\bprops\\.${prop.name}\\b`, 'g'),
        prop.name
      );
    }

    return `const [${state.name}, ${setterName}] = useState(${initialValue});`;
  });

  return declarations.join('\n');
}

/**
 * Generate useRef declarations for element references
 */
function generateRefDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  if (!ir.refs || ir.refs.length === 0) return '';

  const declarations = ir.refs.map((ref) => {
    return `const ${ref.name} = useRef(null);`;
  });

  return declarations.join('\n');
}

/**
 * Generate useMemo declarations for derived values
 */
function generateDerivedDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.derived.map((derived) => {
    const expr = transformExpression(derived.expression, ir);
    const deps = derived.dependencies.map((dep) => dep).join(', ');

    return `const ${derived.name} = useMemo(() => ${arrowBody(expr)}, [${deps}]);`;
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
 * Generate useEffect declarations
 */
function applySetterTransforms(body: string, ctx: GeneratorContext): string {
  for (const [stateName, setter] of ctx.stateSetters) {
    body = body.replace(new RegExp(`\\b${stateName}\\+\\+`, 'g'), `${setter}(${stateName} + 1)`);
    body = body.replace(new RegExp(`\\b${stateName}--`, 'g'), `${setter}(${stateName} - 1)`);
    // Rewrite a compound assignment `name += value` to `setName(name + value)`.
    // This has to run before the plain-assignment rule below, whose guard
    // deliberately skips compound operators so they are not mangled into
    // `setName(+= value)`. Without this the operator survives into the output as
    // `count += 1`, which mutates the `const` binding from useState instead of
    // scheduling a render.
    body = body.replace(
      new RegExp(`\\b${stateName}\\s*(${COMPOUND_ASSIGNMENT_OPERATORS})=\\s*([^;]+);`, 'g'),
      (_match, op, value) => `${setter}(${stateName} ${op} ${String(value).trim()});`
    );
    // Rewrite a plain assignment `name = value` to `setName(value)`. The value
    // must not cross a `;` (a statement boundary) — otherwise a multi-statement
    // body like `a = 1; b = 2;` collapses into `setA(1; setB(2))`. The leading
    // `(?![=<>!+\-*/%&|^])` after `=` rejects compound/comparison operators
    // (`==`, `+=`, `<=`, …) so only true assignments are rewritten.
    body = body.replace(
      new RegExp(`\\b${stateName}\\s*=\\s*(?![=<>!+\\-*/%&|^])([^;]+);`, 'g'),
      `${setter}($1);`
    );
  }
  return body;
}

/**
 * Rewrite `$state` assignments inside an inline event-handler expression so they
 * go through the React setter. Handles both block bodies (`() => { a = 1; }`,
 * delegated to applySetterTransforms) and the expression-bodied arrow form
 * (`() => a = 5`), which has no statement terminator for the block path to anchor
 * to. A bare reference or call (`increment`, `() => foo()`) is returned unchanged.
 */
function transformHandler(handler: string, ctx: GeneratorContext): string {
  let result = applySetterTransforms(handler, ctx);

  // Expression-bodied arrow assigning to a state var: `(...) => name = value`.
  // applySetterTransforms only rewrites `;`-terminated statements, so catch the
  // un-terminated trailing assignment here.
  for (const [stateName, setter] of ctx.stateSetters) {
    result = result.replace(
      new RegExp(`(=>\\s*)${stateName}\\s*=\\s*(?![=<>!+\\-*/%&|^])([^;{].*)$`),
      `$1${setter}($2)`
    );
  }

  return result;
}

function generateEffectDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.effects.map((effect) => {
    let expr = transformExpression(effect.expression, ir);
    expr = applySetterTransforms(expr, ctx);
    const deps = effect.dependencies.join(', ');
    const effectBody = expr.startsWith('{') ? expr : `{\n${indent(expr)}\n}`;
    return `useEffect(() => ${effectBody}, [${deps}]);`;
  });

  return declarations.join('\n');
}

/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.functions.map((func) => {
    const params = func.params?.join(', ') || '';
    let body = applySetterTransforms(func.body, ctx);
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
      return `{${transformExpression(node.expression, {} as any)}}`;

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
 * Emit the `style` prop.
 *
 * React's style prop is an object, so a CSS declaration string has to be
 * converted. A static string is converted at compile time; anything dynamic —
 * a template literal, a variable, a ternary — goes through the runtime helper,
 * which passes non-string values (an object the author already built) through
 * unchanged.
 */
function styleProp(value: string, ctx: GeneratorContext): string {
  const trimmed = value.trim();

  const staticString = trimmed.match(/^(["'])([\s\S]*)\1$/);
  if (staticString) {
    const parsed = parseStaticStyle(staticString[2]);
    if (parsed) {
      return `style={${objectLiteral(
        Object.fromEntries(
          Object.entries(parsed).map(([key, cssValue]) => [
            JSON.stringify(key),
            JSON.stringify(cssValue)
          ])
        )
      )}}`;
    }
  }

  // An object literal is already the shape React wants.
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return `style={${trimmed}}`;
  }

  ctx.usesStyleHelper = true;
  return `style={${STYLE_HELPER_NAME}(${trimmed})}`;
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
    const transformedValue = transformExpression(valueStr, {} as any);

    if (key === 'class') {
      // Check if it's a static string (wrapped in quotes)
      if (transformedValue.startsWith('"') && transformedValue.endsWith('"')) {
        props.push(`className=${transformedValue}`);
      } else {
        props.push(`className={${transformedValue}}`);
      }
    } else if (key === 'style') {
      props.push(styleProp(transformedValue, ctx));
    } else {
      // Check if it's a static string (wrapped in quotes)
      if (transformedValue.startsWith('"') && transformedValue.endsWith('"')) {
        props.push(`${key}=${transformedValue}`);
      } else {
        props.push(`${key}={${transformedValue}}`);
      }
    }
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      // Event handler: on:click -> onClick
      const eventName = 'on' + capitalize(attr.name.slice(3));
      const handler = transformHandler(attr.value.replace('functions.', ''), ctx);
      if (attr.modifiers && attr.modifiers.length > 0) {
        props.push(`${eventName}={${generateModifierWrapper(attr.modifiers, handler)}}`);
      } else {
        // Wrap call expressions in an arrow function so they aren't invoked on render
        // A call expression (`foo()`) must be wrapped so it isn't invoked on
        // render, but an inline handler that is already a function — `(e) => …`,
        // `function …`, or `async () => …` — must be emitted as-is.
        const trimmed = handler.trimStart();
        const isAlreadyHandler = trimmed.startsWith('(') ||
          trimmed.startsWith('function') ||
          /^async\b/.test(trimmed);
        const isCallExpr = /\w+\(.*\)/.test(handler) && !isAlreadyHandler;
        const handlerExpr = isCallExpr ? `() => ${handler}` : handler;
        props.push(`${eventName}={${handlerExpr}}`);
      }
    } else if (attr.name === 'bind:this') {
      // Element reference: bind:this={inputElement} -> ref={inputElement}
      const varName = attr.value.replace('state.', '');
      props.push(`ref={${varName}}`);
    } else if (attr.name.startsWith('bind:')) {
      // Two-way binding: bind:value
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');
      const setter = ctx.stateSetters.get(varName);

      props.push(`${propName}={${varName}}`);
      if (setter) {
        props.push(`onChange={(e) => ${setter}(e.target.value)}`);
      }
    } else if (attr.name.startsWith('class:')) {
      // Class directive: class:active={isActive}
      // For now, skip these (would need className logic)
    } else if (attr.name === 'style') {
      props.push(styleProp(attr.value.replace(/^(state|props|derived)\./, ''), ctx));
    } else {
      // Regular attribute
      const attrName = attr.name === 'class' ? 'className' : attr.name;
      const attrValue = attr.value.replace(/^(state|props|derived)\./, '');

      // Check if value looks like a variable reference (needs braces)
      // If it's already a string, keep it as a string
      if (attrValue && attrValue !== 'true' && attrValue !== 'false' && !attrValue.match(/^["'].*["']$/)) {
        props.push(`${attrName}={${attrValue}}`);
      } else if (attrValue === 'true' || attrValue === 'false') {
        props.push(`${attrName}={${attrValue}}`);
      } else {
        props.push(`${attrName}=${attrValue}`);
      }
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
 * React has no slot element. The default slot is `props.children`; a named slot
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
    return transformExpression(node.expression, {} as any);
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
 * Generate if statement JSX
 */
function generateIfJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const condition = transformExpression(node.condition, {} as any);
  const consequent = wrapJsxChildren(
    node.consequent.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
  );

  if (!node.alternate || node.alternate.length === 0) {
    return `{${condition} && (\n${indent(consequent)}\n)}`;
  }

  return `{${condition} ? (\n${indent(consequent)}\n) : ${generateElseBranch(node.alternate, ctx, depth)}}`;
}

/**
 * Render the else branch of a ternary. When the alternate is a single nested
 * IfNode (an `{:else if}` chain), emit a flat ternary cascade
 * (`cond ? (...) : ...`) rather than wrapping the nested conditional in `(...)`,
 * which would drop a bare object literal into a JSX expression slot.
 */
function generateElseBranch(alternate: any[], ctx: GeneratorContext, depth: number): string {
  if (alternate.length === 1 && alternate[0].type === 'if') {
    const elseIf = alternate[0];
    const condition = transformExpression(elseIf.condition, {} as any);
    const consequent = wrapJsxChildren(
      elseIf.consequent.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
    );

    if (!elseIf.alternate || elseIf.alternate.length === 0) {
      // `{:else if}` with no trailing `{:else}` — render nothing when false.
      return `${condition} ? (\n${indent(consequent)}\n) : null`;
    }

    return `${condition} ? (\n${indent(consequent)}\n) : ${generateElseBranch(elseIf.alternate, ctx, depth)}`;
  }

  const alternateJsx = wrapJsxChildren(
    alternate.map((child: any) => generateJSX(child, ctx, depth + 1)).filter(Boolean)
  );
  return `(\n${indent(alternateJsx)}\n)`;
}

/**
 * Join sibling JSX children, wrapping in a fragment when there is more than one
 * so the result is a single valid JSX expression.
 */
function wrapJsxChildren(children: string[]): string {
  const joined = children.join('\n');
  if (children.length <= 1) {
    return joined;
  }
  return `<>\n${indent(joined)}\n</>`;
}

/**
 * Generate each loop JSX
 */
function generateEachJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const array = transformExpression(node.expression, {} as any);
  const item = node.itemName;
  const index = node.indexName || 'index';
  const key = node.key ? transformExpression(node.key, {} as any) : index;

  const renderedChildren = node.children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean);

  const body = eachReturnBody(renderedChildren, index);

  return `{${array}.map((${item}, ${index}) => (\n${indent(body)}\n))}`;
}

/**
 * Build the JSX a `.map()` callback returns. The arrow already supplies an
 * expression position, so a conditional/expression child must be emitted
 * without its outer `{...}` (otherwise `( {expr} )` is read as an object
 * literal). Multiple children are wrapped in a fragment so the callback returns
 * a single node.
 */
function eachReturnBody(children: string[], index: string): string {
  if (children.length === 1) {
    const only = children[0];
    // A single conditional/expression child is already `{...}`; unwrap it.
    const unwrapped = stripJsxBraces(only);
    if (unwrapped !== only.trim()) {
      return unwrapped;
    }
    // A single element child: inject the key prop.
    return only.replace(/^(<\w[^>]*?)( \/>|>)/, `$1 key={${index}}$2`);
  }

  // Multiple children: key the first element and wrap them in a fragment.
  const joined = children.join('\n');
  const keyed = joined.replace(/^(<\w[^>]*?)( \/>|>)/, `$1 key={${index}}$2`);
  return `<>\n${indent(keyed)}\n</>`;
}

/**
 * Generate render block JSX (for {@render snippet()} syntax)
 * Always generates defensive code that safely handles undefined snippets
 */
function generateRenderJSX(node: any, ctx: GeneratorContext): string {
  const snippet = node.snippet;
  const args = node.args || [];
  const argsList = args.length > 0 ? args.join(', ') : '';

  // Always generate defensive code that checks if snippet exists
  return `{${snippet}?.(${argsList})}`;
}

/**
 * Transform IR expression to JavaScript
 */
function transformExpression(expr: string, ir: DurableComponentIR): string {
  // Remove IR prefixes (state., props., derived.)
  let transformed = expr;

  transformed = transformed.replace(/\bstate\./g, '');
  transformed = transformed.replace(/\bprops\./g, '');
  transformed = transformed.replace(/\bderived\./g, '');
  transformed = transformed.replace(/\bfunctions\./g, '');

  return transformed;
}

/**
 * Name a `<dce:element>` tag expression so it can be used as a JSX tag.
 *
 * JSX resolves a lowercase tag to a host element, so emitting the expression
 * directly turned `<dce:element this={tag}>` into a literal `<tag>` element.
 * Binding the expression to a capitalized local first is the idiomatic React
 * form and works for any expression, not just bare identifiers.
 */
function dynamicTagAlias(expression: string, ctx: GeneratorContext): string {
  const existing = ctx.dynamicTags.get(expression);
  if (existing) return existing;

  const alias = `DceTag${ctx.dynamicTags.size + 1}`;
  ctx.dynamicTags.set(expression, alias);
  return alias;
}

/**
 * Generate dce:element JSX (dynamic element tag)
 */
function generateDceElementJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  const { tagExpression, attributes = [], bindings = {}, children = [] } = node;

  // Transform the tag expression, then bind it to a capitalized local so JSX
  // treats it as a component rather than a host element.
  const Tag = dynamicTagAlias(transformExpression(tagExpression, {} as any), ctx);

  // Collect all props (same as regular element)
  const props: string[] = [];

  // Handle bindings
  for (const [key, value] of Object.entries(bindings)) {
    const valueStr = String(value);
    const transformedValue = transformExpression(valueStr, {} as any);

    if (key === 'class') {
      if (transformedValue.startsWith('"') && transformedValue.endsWith('"')) {
        props.push(`className=${transformedValue}`);
      } else {
        props.push(`className={${transformedValue}}`);
      }
    } else if (key === 'style') {
      props.push(styleProp(transformedValue, ctx));
    } else {
      if (transformedValue.startsWith('"') && transformedValue.endsWith('"')) {
        props.push(`${key}=${transformedValue}`);
      } else {
        props.push(`${key}={${transformedValue}}`);
      }
    }
  }

  // Handle attributes
  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      const eventName = 'on' + capitalize(attr.name.slice(3));
      const handler = transformHandler(attr.value.replace('functions.', ''), ctx);
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;
      props.push(`${eventName}={${finalHandler}}`);
    } else if (attr.name.startsWith('bind:')) {
      const propName = attr.name.slice(5);
      const varName = attr.value.replace('state.', '');
      const setter = ctx.stateSetters.get(varName);
      props.push(`${propName}={${varName}}`);
      if (setter && propName === 'value') {
        props.push(`onChange={(e) => ${setter}(e.target.value)}`);
      }
    } else if (attr.name === 'style') {
      props.push(styleProp(attr.value.replace(/^(state|props|derived)\./, ''), ctx));
    } else {
      const attrName = attr.name === 'class' ? 'className' : attr.name;
      const attrValue = attr.value.replace(/^(state|props|derived)\./, '');
      if (attrValue && attrValue !== 'true' && attrValue !== 'false' && !attrValue.match(/^["'].*["']$/)) {
        props.push(`${attrName}={${attrValue}}`);
      } else if (attrValue === 'true' || attrValue === 'false') {
        props.push(`${attrName}={${attrValue}}`);
      } else {
        props.push(`${attrName}=${attrValue}`);
      }
    }
  }

  const propsStr = props.length > 0 ? ' ' + props.join(' ') : '';

  // Handle children
  if (children.length === 0) {
    return `<${Tag}${propsStr} />`;
  }

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childrenJSX.trim()) {
    return `<${Tag}${propsStr} />`;
  }

  return `<${Tag}${propsStr}>\n${indent(childrenJSX)}\n</${Tag}>`;
}

/**
 * Generate dce:window JSX (window event handlers)
 */
function generateDceWindowJSX(node: any, ctx: GeneratorContext): string {
  ctx.usedHooks.add('useEffect');

  const { attributes = [] } = node;
  const eventHandlers: string[] = [];

  for (const attr of attributes) {
    if (attr.name.startsWith('on:')) {
      const eventName = attr.name.slice(3);
      const handler = attr.value.replace('functions.', '');
      const finalHandler = attr.modifiers && attr.modifiers.length > 0
        ? generateModifierWrapper(attr.modifiers, handler)
        : handler;

      eventHandlers.push(`window.addEventListener('${eventName}', ${finalHandler});`);
    }
  }

  // This will generate useEffect code in the component body
  // For now, return empty string as this needs to be handled in script generation
  // TODO: Refactor to properly inject window event handlers into useEffect
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
  // React error boundaries require class components or use-error-boundary library
  // For now, wrap children in a simple ErrorBoundary component
  const { children = [], attributes = [] } = node;

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  // Find the onerror handler if specified
  let onError = 'console.error';
  for (const attr of attributes) {
    if (attr.name === 'onerror') {
      onError = attr.value.replace('functions.', '');
    }
  }

  return `<ErrorBoundary onError={${onError}}>\n${indent(childrenJSX)}\n</ErrorBoundary>`;
}

/**
 * Generate dce:head JSX (document head)
 */
function generateDceHeadJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  // React requires react-helmet or react-helmet-async for head management
  // Generate using Helmet component
  const { children = [] } = node;

  const childrenJSX = children
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `<Helmet>\n${indent(childrenJSX)}\n</Helmet>`;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
