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

interface GeneratorContext {
  /** Track used Solid primitives for imports */
  usedPrimitives: Set<string>;
  /** Track state getters for signal access */
  stateGetters: Map<string, string>;
  /** Track state setters for reference */
  stateSetters: Map<string, string>;
  /** Track derived values (memos) */
  derivedNames: Set<string>;
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
  const code = joinStatements(solidImports, externalImports, types, propsInterface, component);

  return {
    code
  };
}

/**
 * Generate Solid imports based on used primitives
 */
function generateSolidImports(ctx: GeneratorContext): string {
  if (ctx.usedPrimitives.size === 0) {
    return '';
  }

  const primitives = Array.from(ctx.usedPrimitives).sort();
  return `import { ${primitives.join(', ')} } from 'solid-js';`;
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

  // Generate JSX return
  const jsx = generateJSX(ir.template, ctx);
  body.push(`return (\n${indent(jsx)}\n);`);

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

    return `const ${derived.name} = createMemo(() => ${expr});`;
  });

  return declarations.join('\n');
}

/**
 * Generate createEffect declarations
 */
function generateEffectDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.effects.map((effect) => {
    const expr = transformExpression(effect.expression, ir, ctx);
    // SolidJS doesn't need dependency arrays - it auto-tracks

    // Handle block vs expression
    const effectBody = expr.startsWith('{') ? expr : `{\n${indent(expr)}\n}`;

    return `createEffect(() => ${effectBody});`;
  });

  return declarations.join('\n');
}

/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.functions.map((func) => {
    const params = func.params?.join(', ') || '';
    let body = func.body;

    // Transform state updates to use setters
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

    // Handle block vs expression body
    const functionBody = body.startsWith('{') ? body : `{\n${indent(body)}\n}`;

    return `const ${func.name} = (${params}) => ${functionBody};`;
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
      return '{props.children}';

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
 * Generate element JSX
 */
function generateElementJSX(
  node: any,
  ctx: GeneratorContext,
  depth: number
): string {
  const { name, attributes = [], bindings = {}, children = [] } = node;

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
  const consequent = node.consequent
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!node.alternate) {
    // SolidJS idiom: use && for simple conditionals
    return `{${condition} && (\n${indent(consequent)}\n)}`;
  }

  const alternate = node.alternate
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  // SolidJS idiom: use ternary for if/else
  return `{${condition} ? (\n${indent(consequent)}\n) : (\n${indent(alternate)}\n)}`;
}

/**
 * Generate each loop JSX (using For component would be better, but .map works)
 */
function generateEachJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const array = transformExpression(node.expression, {} as any, ctx);
  const item = node.itemName;
  const index = node.indexName || 'index';
  const key = node.key ? transformExpression(node.key, {} as any, ctx) : index;

  const children = node.children
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
    .filter(Boolean)
    .join('\n');

  // SolidJS .map() works well for simple cases
  return `{${array}.map((${item}, ${index}) => (\n${indent(children)}\n))}`;
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
