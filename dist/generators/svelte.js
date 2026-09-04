"use strict";
/**
 * Svelte 5 Generator
 *
 * Transforms the canonical IR into a Svelte 5 component using Runes.
 * Since the DSL is based on Svelte 5 Runes, this is essentially a reverse transformation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSvelte = generateSvelte;
const code_gen_1 = require("../utils/code-gen");
const event_modifiers_1 = require("../utils/event-modifiers");
/**
 * Generate Svelte 5 component from IR
 */
function generateSvelte(ir) {
    // Generate script content
    const scriptContent = generateScriptContent(ir);
    // Generate template (HTML)
    const templateContent = generateTemplate(ir.template);
    // Combine script and template
    const parts = [];
    if (scriptContent.trim() || ir.imports || ir.types) {
        const externalImports = generateExternalImports(ir);
        const types = generateTypes(ir);
        const fullScript = (0, code_gen_1.joinStatements)(externalImports, types, scriptContent);
        const scriptLang = ir.lang === 'ts' || ir.lang === 'typescript' ? ' lang="ts"' : '';
        parts.push(`<script${scriptLang}>\n${(0, code_gen_1.indent)(fullScript)}\n</script>`);
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
function generateExternalImports(ir) {
    if (!ir.imports || ir.imports.length === 0)
        return '';
    const imports = ir.imports.map((imp) => {
        const specifiers = [];
        for (const spec of imp.specifiers) {
            if (spec.type === 'default') {
                specifiers.push(spec.local);
            }
            else if (spec.type === 'named') {
                if (spec.imported && spec.imported !== spec.local) {
                    specifiers.push(`${spec.imported} as ${spec.local}`);
                }
                else {
                    specifiers.push(spec.local);
                }
            }
            else if (spec.type === 'namespace') {
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
            const namedSpecs = namedImports.map(s => s.imported && s.imported !== s.local ? `${s.imported} as ${s.local}` : s.local);
            return `import ${defaultImport.local}, { ${namedSpecs.join(', ')} } from '${imp.source}';`;
        }
        else if (defaultImport) {
            return `import ${defaultImport.local} from '${imp.source}';`;
        }
        else {
            return `import { ${specifiers.join(', ')} } from '${imp.source}';`;
        }
    });
    return imports.join('\n');
}
/**
 * Generate TypeScript type definitions
 */
function generateTypes(ir) {
    if (!ir.types || ir.types.length === 0)
        return '';
    return ir.types.map(type => type.body).join('\n\n');
}
/**
 * Generate script section content
 */
function generateScriptContent(ir) {
    const statements = [];
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
function generatePropsDeclaration(ir) {
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
function generateStateDeclarations(ir) {
    const declarations = ir.state.map((state) => {
        let initialValue = state.initialValue;
        // Replace prop references (props.x -> x)
        for (const prop of ir.props) {
            initialValue = initialValue.replace(new RegExp(`\\bprops\\.${prop.name}\\b`, 'g'), prop.name);
        }
        return `let ${state.name} = $state(${initialValue});`;
    });
    return declarations.join('\n');
}
/**
 * Generate $derived() declarations
 */
function generateDerivedDeclarations(ir) {
    const declarations = ir.derived.map((derived) => {
        const expr = transformExpression(derived.expression);
        return `let ${derived.name} = $derived(${expr});`;
    });
    return declarations.join('\n');
}
/**
 * Generate $effect() declarations
 */
function generateEffectDeclarations(ir) {
    const declarations = ir.effects.map((effect) => {
        const expr = transformExpression(effect.expression);
        // If the expression is already a block, use it directly
        // Otherwise, wrap it in an arrow function
        if (expr.startsWith('{')) {
            return `$effect(() => ${expr});`;
        }
        else {
            return `$effect(() => {\n${(0, code_gen_1.indent)(expr)}\n});`;
        }
    });
    return declarations.join('\n\n');
}
/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir) {
    const declarations = ir.functions.map((func) => {
        const params = func.params?.join(', ') || '';
        let body = func.body;
        // Transform state updates (already correct for Svelte 5)
        // In Svelte 5, we can directly mutate state: count++
        // The body should already be in the correct format from the IR
        // Handle block vs expression body
        const functionBody = body.startsWith('{') ? body : `{\n${(0, code_gen_1.indent)(body)}\n}`;
        const asyncPrefix = func.async ? 'async ' : '';
        return `${asyncPrefix}function ${func.name}(${params}) ${functionBody}`;
    });
    return declarations.join('\n\n');
}
/**
 * Generate template (HTML)
 */
function generateTemplate(node, depth = 0) {
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
function generateElement(node, depth) {
    const { name, attributes = [], bindings = {}, children = [] } = node;
    // Collect all attributes
    const attrs = [];
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
                ? (0, event_modifiers_1.generateModifierWrapper)(attr.modifiers, handler)
                : handler;
            attrs.push(`on${eventName}={${finalHandler}}`);
        }
        else if (attr.name.startsWith('bind:')) {
            // Two-way binding: bind:value={var}
            const varName = transformExpression(attr.value);
            attrs.push(`${attr.name}={${varName}}`);
        }
        else if (attr.name.startsWith('class:')) {
            // Class directive: class:active={isActive}
            const condition = transformExpression(attr.value);
            attrs.push(`${attr.name}={${condition}}`);
        }
        else {
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
        .map((child) => generateTemplate(child, depth + 1))
        .filter(Boolean)
        .join('\n');
    if (!childrenHTML.trim()) {
        return `<${name}${attrsStr} />`;
    }
    // Check if children should be indented
    const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;
    if (hasMultipleLines) {
        return `<${name}${attrsStr}>\n${(0, code_gen_1.indent)(childrenHTML)}\n</${name}>`;
    }
    else {
        return `<${name}${attrsStr}>${childrenHTML}</${name}>`;
    }
}
/**
 * Generate if block
 */
function generateIf(node, depth) {
    return `{#if ${transformExpression(node.condition)}}\n${generateIfBranches(node, depth)}\n{/if}`;
}
/**
 * Render the consequent and the else / else-if chain for an {#if} node,
 * WITHOUT the outer `{#if cond}` / `{/if}`. An `{:else if}` in the source is
 * stored as an alternate containing a single nested IfNode; we collapse that
 * back into native Svelte `{:else if}` rather than nesting a fresh `{#if}`
 * inside an `{:else}`.
 */
function generateIfBranches(node, depth) {
    const consequent = node.consequent
        .map((child) => generateTemplate(child, depth + 1))
        .filter(Boolean)
        .join('\n');
    if (!node.alternate || node.alternate.length === 0) {
        return (0, code_gen_1.indent)(consequent);
    }
    // Collapse `{:else}{#if}` into `{:else if}` when the else branch is exactly
    // one IfNode (the shape produced by parsing `{:else if}`).
    if (node.alternate.length === 1 && node.alternate[0].type === 'if') {
        const elseIf = node.alternate[0];
        return `${(0, code_gen_1.indent)(consequent)}\n{:else if ${transformExpression(elseIf.condition)}}\n${generateIfBranches(elseIf, depth)}`;
    }
    const alternate = node.alternate
        .map((child) => generateTemplate(child, depth + 1))
        .filter(Boolean)
        .join('\n');
    return `${(0, code_gen_1.indent)(consequent)}\n{:else}\n${(0, code_gen_1.indent)(alternate)}`;
}
/**
 * Generate each block
 */
function generateEach(node, depth) {
    const array = transformExpression(node.expression);
    const item = node.itemName;
    const index = node.indexName;
    const key = node.key;
    const children = node.children
        .map((child) => generateTemplate(child, depth + 1))
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
    return `${eachHeader}\n${(0, code_gen_1.indent)(children)}\n{/each}`;
}
/**
 * Generate slot
 */
function generateSlot(node) {
    if (node.name) {
        return `<slot name="${node.name}" />`;
    }
    if (node.fallback && node.fallback.length > 0) {
        const fallbackHTML = node.fallback
            .map((child) => generateTemplate(child, 1))
            .filter(Boolean)
            .join('\n');
        return `<slot>\n${(0, code_gen_1.indent)(fallbackHTML)}\n</slot>`;
    }
    return '<slot />';
}
/**
 * Generate render block (for {@render snippet()} syntax)
 * Always generates defensive code that safely handles undefined snippets
 */
function generateRender(node) {
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
function formatBindingAttr(key, rawValue) {
    const isStaticString = (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
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
function transformExpression(expr) {
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
function generateDceElement(node, depth) {
    const { tagExpression, attributes = [], bindings = {}, children = [] } = node;
    // Transform the tag expression
    const tag = transformExpression(tagExpression);
    // Collect all attributes
    const attrs = [];
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
                ? (0, event_modifiers_1.generateModifierWrapper)(attr.modifiers, handler)
                : handler;
            attrs.push(`on${eventName}={${finalHandler}}`);
        }
        else if (attr.name.startsWith('bind:')) {
            const varName = transformExpression(attr.value);
            attrs.push(`${attr.name}={${varName}}`);
        }
        else if (attr.name.startsWith('class:')) {
            const condition = transformExpression(attr.value);
            attrs.push(`${attr.name}={${condition}}`);
        }
        else {
            attrs.push(`${attr.name}="${attr.value}"`);
        }
    }
    const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    // Handle children
    if (children.length === 0) {
        return `<svelte:element${attrsStr} />`;
    }
    const childrenHTML = children
        .map((child) => generateTemplate(child, depth + 1))
        .filter(Boolean)
        .join('\n');
    if (!childrenHTML.trim()) {
        return `<svelte:element${attrsStr} />`;
    }
    const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;
    if (hasMultipleLines) {
        return `<svelte:element${attrsStr}>\n${(0, code_gen_1.indent)(childrenHTML)}\n</svelte:element>`;
    }
    else {
        return `<svelte:element${attrsStr}>${childrenHTML}</svelte:element>`;
    }
}
/**
 * Generate dce:window (window event handlers)
 */
function generateDceWindow(node) {
    const { attributes = [] } = node;
    // Collect all attributes
    const attrs = [];
    for (const attr of attributes) {
        if (attr.name.startsWith('on:')) {
            const eventName = attr.name.slice(3);
            const handler = transformExpression(attr.value);
            const finalHandler = attr.modifiers && attr.modifiers.length > 0
                ? (0, event_modifiers_1.generateModifierWrapper)(attr.modifiers, handler)
                : handler;
            attrs.push(`on${eventName}={${finalHandler}}`);
        }
    }
    const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    return `<svelte:window${attrsStr} />`;
}
/**
 * Generate dce:boundary (error boundary)
 */
function generateDceBoundary(node, depth) {
    // Svelte doesn't have a built-in error boundary
    // Users would need to create a wrapper component
    const { children = [], attributes = [] } = node;
    const childrenHTML = children
        .map((child) => generateTemplate(child, depth + 1))
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
        return `<ErrorBoundary onerror={${onError}}>\n${(0, code_gen_1.indent)(childrenHTML)}\n</ErrorBoundary>`;
    }
    else {
        return `<ErrorBoundary onerror={${onError}}>${childrenHTML}</ErrorBoundary>`;
    }
}
/**
 * Generate dce:head (document head)
 */
function generateDceHead(node, depth) {
    // Svelte has built-in <svelte:head> for document head
    const { children = [] } = node;
    const childrenHTML = children
        .map((child) => generateTemplate(child, depth + 1))
        .filter(Boolean)
        .join('\n');
    if (!childrenHTML.trim()) {
        return '<svelte:head />';
    }
    const hasMultipleLines = childrenHTML.includes('\n') || children.length > 1;
    if (hasMultipleLines) {
        return `<svelte:head>\n${(0, code_gen_1.indent)(childrenHTML)}\n</svelte:head>`;
    }
    else {
        return `<svelte:head>${childrenHTML}</svelte:head>`;
    }
}
