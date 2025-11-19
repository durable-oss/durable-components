/**
 * React Generator
 *
 * Transforms the canonical IR into a React functional component using Hooks.
 * This implements the mapping defined in Table 3 of the architectural plan.
 */

import type { DurableComponentIR, TemplateNode } from '../types/ir';
import type { CompiledJS } from '../types/compiler';
import { indent, joinStatements, objectLiteral } from '../utils/code-gen';

interface GeneratorContext {
  /** Track used hooks for imports */
  usedHooks: Set<string>;
  /** Track state setters for reference */
  stateSetters: Map<string, string>;
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
    componentName: ir.name
  };

  // Generate component body
  const externalImports = generateExternalImports(ir);
  const types = generateTypes(ir);
  const propsInterface = generatePropsInterface(ir);
  const component = generateComponent(ir, ctx);

  // Generate React imports
  const reactImports = generateReactImports(ctx);

  // Combine all parts
  const code = joinStatements(reactImports, externalImports, types, propsInterface, component);

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

    return `const ${derived.name} = useMemo(() => ${expr}, [${deps}]);`;
  });

  return declarations.join('\n');
}

/**
 * Generate useEffect declarations
 */
function generateEffectDeclarations(ir: DurableComponentIR, ctx: GeneratorContext): string {
  const declarations = ir.effects.map((effect) => {
    const expr = transformExpression(effect.expression, ir);
    const deps = effect.dependencies.map((dep) => dep).join(', ');

    // Handle block vs expression
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
    let body = func.body;

    // Transform state updates to use setters
    for (const state of ir.state) {
      const setter = ctx.stateSetters.get(state.name);
      if (setter) {
        // Replace count++ with setCount(count + 1)
        body = body.replace(
          new RegExp(`\\b${state.name}\\+\\+`, 'g'),
          `${setter}(${state.name} + 1)`
        );
        body = body.replace(
          new RegExp(`\\b${state.name}--`, 'g'),
          `${setter}(${state.name} - 1)`
        );
        // Replace count = value with setCount(value)
        body = body.replace(
          new RegExp(`\\b${state.name}\\s*=\\s*([^=].+?);`, 'g'),
          `${setter}($1);`
        );
      }
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
      return `{${transformExpression(node.expression, {} as any)}}`;

    case 'if':
      return generateIfJSX(node, ctx, depth);

    case 'each':
      return generateEachJSX(node, ctx, depth);

    case 'slot':
      return '{props.children}';

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
    const transformedValue = transformExpression(valueStr, {} as any);

    if (key === 'class') {
      // Check if it's a static string (wrapped in quotes)
      if (transformedValue.startsWith('"') && transformedValue.endsWith('"')) {
        props.push(`className=${transformedValue}`);
      } else {
        props.push(`className={${transformedValue}}`);
      }
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
      const handler = attr.value.replace('functions.', '');
      props.push(`${eventName}={${handler}}`);
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

/**
 * Generate if statement JSX
 */
function generateIfJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const condition = transformExpression(node.condition, {} as any);
  const consequent = node.consequent
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!node.alternate) {
    return `{${condition} && (\n${indent(consequent)}\n)}`;
  }

  const alternate = node.alternate
    .map((child: any) => generateJSX(child, ctx, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `{${condition} ? (\n${indent(consequent)}\n) : (\n${indent(alternate)}\n)}`;
}

/**
 * Generate each loop JSX
 */
function generateEachJSX(node: any, ctx: GeneratorContext, depth: number): string {
  const array = transformExpression(node.expression, {} as any);
  const item = node.itemName;
  const index = node.indexName || 'index';

  const children = node.children
    .map((child: any) => {
      // Replace item references in children
      let jsx = generateJSX(child, ctx, depth + 1);
      // This is simplified - would need proper scoping
      return jsx;
    })
    .filter(Boolean)
    .join('\n');

  return `{${array}.map((${item}, ${index}) => (\n${indent(children)}\n))}`;
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
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
