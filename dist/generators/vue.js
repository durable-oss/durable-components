"use strict";
/**
 * Vue 3 Generator
 *
 * Transforms the canonical IR into a Vue 3 component using Composition API.
 * This implements the mapping from IR to Vue 3 reactive primitives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVue = generateVue;
const code_gen_1 = require("../utils/code-gen");
/**
 * Generate Vue 3 component from IR
 */
function generateVue(ir) {
    const ctx = {
        usedComposables: new Set(),
        stateRefs: new Set(),
        computedNames: new Set(),
        componentName: ir.name
    };
    // Generate script setup content
    const scriptContent = generateScriptSetup(ir, ctx);
    // Generate template (HTML)
    const templateContent = generateTemplate(ir.template, ctx);
    // Combine script and template
    const parts = [];
    if (scriptContent.trim() || ir.imports || ir.types) {
        // Generate imports
        const vueImports = generateVueImports(ctx);
        const externalImports = generateExternalImports(ir);
        const types = generateTypes(ir);
        const imports = (0, code_gen_1.joinStatements)(vueImports, externalImports);
        const fullScript = (0, code_gen_1.joinStatements)(imports, types, scriptContent);
        const scriptLang = ir.lang === 'ts' || ir.lang === 'typescript' ? ' lang="ts"' : '';
        parts.push(`<script setup${scriptLang}>\n${(0, code_gen_1.indent)(fullScript)}\n</script>`);
    }
    if (templateContent.trim()) {
        parts.push(`<template>\n${(0, code_gen_1.indent)(templateContent)}\n</template>`);
    }
    const code = parts.join('\n\n');
    return {
        code
    };
}
/**
 * Generate Vue imports based on used composables
 */
function generateVueImports(ctx) {
    if (ctx.usedComposables.size === 0) {
        return '';
    }
    const composables = Array.from(ctx.usedComposables).sort();
    return `import { ${composables.join(', ')} } from 'vue';`;
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
 * Generate script setup section content
 */
function generateScriptSetup(ir, ctx) {
    const statements = [];
    // Generate props
    if (ir.props.length > 0) {
        statements.push(generatePropsDeclaration(ir));
    }
    // Generate state (refs)
    if (ir.state.length > 0) {
        ctx.usedComposables.add('ref');
        statements.push(generateStateDeclarations(ir, ctx));
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
    return statements.filter(Boolean).join('\n\n');
}
/**
 * Generate defineProps() declaration
 */
function generatePropsDeclaration(ir) {
    const propsWithDefaults = ir.props.filter(p => p.defaultValue);
    const propsWithoutDefaults = ir.props.filter(p => !p.defaultValue);
    if (propsWithDefaults.length === 0) {
        // Simple defineProps without defaults
        const propsList = ir.props.map(prop => {
            const type = prop.type || 'any';
            return `  ${prop.name}: ${type}`;
        });
        return `const props = defineProps({\n${propsList.join(',\n')}\n});`;
    }
    // Use withDefaults for props with default values
    const propsInterface = ir.props.map(prop => {
        const optional = prop.defaultValue ? '?' : '';
        const type = prop.type || 'any';
        return `  ${prop.name}${optional}: ${type};`;
    });
    const defaults = propsWithDefaults.map(prop => {
        return `  ${prop.name}: ${prop.defaultValue}`;
    });
    return `const props = withDefaults(defineProps<{\n${propsInterface.join('\n')}\n}>(), {\n${defaults.join(',\n')}\n});`;
}
/**
 * Generate ref() declarations for state
 */
function generateStateDeclarations(ir, ctx) {
    const declarations = ir.state.map((state) => {
        ctx.stateRefs.add(state.name);
        let initialValue = state.initialValue;
        // If initial value references props, ensure it has props. prefix
        // Check if the value matches any prop name
        for (const prop of ir.props) {
            // Match the prop name as a standalone identifier (not already prefixed with props.)
            initialValue = initialValue.replace(new RegExp(`\\b(?<!props\\.)${prop.name}\\b`, 'g'), `props.${prop.name}`);
        }
        return `const ${state.name} = ref(${initialValue});`;
    });
    return declarations.join('\n');
}
/**
 * Generate computed() declarations for derived values
 */
function generateDerivedDeclarations(ir, ctx) {
    const declarations = ir.derived.map((derived) => {
        ctx.computedNames.add(derived.name);
        const expr = transformExpression(derived.expression, ctx);
        // Vue doesn't need dependency arrays - it auto-tracks
        return `const ${derived.name} = computed(() => ${expr});`;
    });
    return declarations.join('\n');
}
/**
 * Generate watchEffect() declarations
 */
function generateEffectDeclarations(ir, ctx) {
    const declarations = ir.effects.map((effect) => {
        const expr = transformExpression(effect.expression, ctx);
        // Handle block vs expression
        const effectBody = expr.startsWith('{') ? expr : `{\n${(0, code_gen_1.indent)(expr)}\n}`;
        return `watchEffect(() => ${effectBody});`;
    });
    return declarations.join('\n\n');
}
/**
 * Generate function declarations
 */
function generateFunctionDeclarations(ir, ctx) {
    const declarations = ir.functions.map((func) => {
        const params = func.params?.join(', ') || '';
        let body = func.body;
        // First, transform all state references to use .value
        // (except when already followed by .value)
        for (const state of ir.state) {
            body = body.replace(new RegExp(`\\b${state.name}(?!\\.value)\\b`, 'g'), `${state.name}.value`);
        }
        // Then handle special cases for state updates
        for (const state of ir.state) {
            // Replace count.value++ (which is already correct)
            // Replace count.value-- (which is already correct)
            // These should already be correct from the previous transformation
        }
        // Handle block vs expression body
        const functionBody = body.startsWith('{') ? body : `{\n${(0, code_gen_1.indent)(body)}\n}`;
        return `const ${func.name} = (${params}) => ${functionBody};`;
    });
    return declarations.join('\n\n');
}
/**
 * Generate template (HTML)
 */
function generateTemplate(node, ctx, depth = 0) {
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
        case 'comment':
            return `<!-- ${node.content} -->`;
        default:
            return '';
    }
}
/**
 * Generate element
 */
function generateElement(node, ctx, depth) {
    const { name, attributes = [], bindings = {}, children = [] } = node;
    // Collect all attributes
    const attrs = [];
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
        }
        else {
            // Dynamic binding
            const transformedValue = transformTemplateExpression(valueStr, ctx);
            if (key === 'class') {
                attrs.push(`:class="${transformedValue}"`);
            }
            else {
                attrs.push(`:${key}="${transformedValue}"`);
            }
        }
    }
    // Handle attributes (events, bindings, etc.)
    for (const attr of attributes) {
        if (attr.name.startsWith('on:')) {
            // Event handler: on:click -> @click
            const eventName = attr.name.slice(3);
            const handler = transformTemplateExpression(attr.value, ctx);
            attrs.push(`@${eventName}="${handler}"`);
        }
        else if (attr.name.startsWith('bind:')) {
            // Two-way binding: bind:value -> v-model
            const propName = attr.name.slice(5);
            const varName = attr.value.replace('state.', '');
            if (propName === 'value') {
                attrs.push(`v-model="${varName}"`);
            }
            else if (propName === 'checked') {
                attrs.push(`v-model="${varName}"`);
            }
            else {
                // Generic binding
                attrs.push(`v-model:${propName}="${varName}"`);
            }
        }
        else if (attr.name.startsWith('class:')) {
            // Class directive: class:active={isActive}
            // Convert to Vue's class binding syntax
            const className = attr.name.slice(6);
            const condition = transformTemplateExpression(attr.value, ctx);
            attrs.push(`:class="{ '${className}': ${condition} }"`);
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
        .map((child) => generateTemplate(child, ctx, depth + 1))
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
function generateIf(node, ctx, depth) {
    const condition = transformTemplateExpression(node.condition, ctx);
    const consequent = node.consequent
        .map((child) => generateTemplate(child, ctx, depth))
        .filter((s) => s.trim().length > 0)
        .join('\n');
    if (!node.alternate) {
        // Find the first element to attach v-if to
        const lines = consequent.split('\n');
        // Find the first line that starts with a tag
        const firstTagLineIdx = lines.findIndex((line) => line.trim().startsWith('<'));
        if (firstTagLineIdx >= 0) {
            // Insert v-if into the first tag
            const firstLine = lines[firstTagLineIdx].replace(/^(\s*<\w+)/, `$1 v-if="${condition}"`);
            const result = [...lines.slice(0, firstTagLineIdx), firstLine, ...lines.slice(firstTagLineIdx + 1)];
            return result.join('\n');
        }
        return consequent;
    }
    const alternate = node.alternate
        .map((child) => generateTemplate(child, ctx, depth))
        .filter((s) => s.trim().length > 0)
        .join('\n');
    // Add v-if to consequent and v-else to alternate
    const consequentLines = consequent.split('\n');
    const alternateLines = alternate.split('\n');
    const firstConsequentLineIdx = consequentLines.findIndex((line) => line.trim().startsWith('<'));
    const firstAlternateLineIdx = alternateLines.findIndex((line) => line.trim().startsWith('<'));
    if (firstConsequentLineIdx >= 0) {
        const firstLine = consequentLines[firstConsequentLineIdx].replace(/^(\s*<\w+)/, `$1 v-if="${condition}"`);
        consequentLines[firstConsequentLineIdx] = firstLine;
    }
    if (firstAlternateLineIdx >= 0) {
        const firstLine = alternateLines[firstAlternateLineIdx].replace(/^(\s*<\w+)/, `$1 v-else`);
        alternateLines[firstAlternateLineIdx] = firstLine;
    }
    return `${consequentLines.join('\n')}\n${alternateLines.join('\n')}`;
}
/**
 * Generate each block
 */
function generateEach(node, ctx, depth) {
    const array = transformTemplateExpression(node.expression, ctx);
    const item = node.itemName;
    const index = node.indexName;
    const key = node.key;
    const children = node.children
        .map((child) => generateTemplate(child, ctx, depth))
        .filter((s) => s.trim().length > 0)
        .join('\n');
    // Build v-for directive
    let vFor = `v-for="`;
    if (index) {
        vFor += `(${item}, ${index})`;
    }
    else {
        vFor += item;
    }
    vFor += ` in ${array}"`;
    // Add key if specified
    const keyAttr = key ? ` :key="${key}"` : '';
    // Insert v-for into the first child element
    const childLines = children.split('\n');
    const firstTagLineIdx = childLines.findIndex((line) => line.trim().startsWith('<'));
    if (firstTagLineIdx >= 0) {
        const firstLine = childLines[firstTagLineIdx].replace(/^(\s*<\w+)/, `$1 ${vFor}${keyAttr}`);
        const result = [...childLines.slice(0, firstTagLineIdx), firstLine, ...childLines.slice(firstTagLineIdx + 1)];
        return result.join('\n');
    }
    return children;
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
            .map((child) => generateTemplate(child, {}, 1))
            .filter(Boolean)
            .join('\n');
        return `<slot>\n${(0, code_gen_1.indent)(fallbackHTML)}\n</slot>`;
    }
    return '<slot />';
}
/**
 * Transform IR expression to Vue expression (for script)
 * Remove IR prefixes and add .value for refs
 */
function transformExpression(expr, ctx) {
    let transformed = expr;
    // Remove IR prefixes
    transformed = transformed.replace(/\bstate\./g, '');
    transformed = transformed.replace(/\bprops\./g, 'props.');
    transformed = transformed.replace(/\bderived\./g, '');
    transformed = transformed.replace(/\bfunctions\./g, '');
    // Add .value for state refs (except when already followed by .value)
    if (ctx.stateRefs) {
        for (const stateName of ctx.stateRefs) {
            transformed = transformed.replace(new RegExp(`\\b${stateName}(?!\\.value)\\b`, 'g'), `${stateName}.value`);
        }
    }
    // Add .value for computed values (they also need .value in script)
    if (ctx.computedNames) {
        for (const computedName of ctx.computedNames) {
            transformed = transformed.replace(new RegExp(`\\b${computedName}(?!\\.value)\\b`, 'g'), `${computedName}.value`);
        }
    }
    return transformed;
}
/**
 * Transform IR expression to Vue template expression
 * Remove IR prefixes (refs are automatically unwrapped in templates)
 */
function transformTemplateExpression(expr, ctx) {
    let transformed = expr;
    // Remove IR prefixes
    transformed = transformed.replace(/\bstate\./g, '');
    transformed = transformed.replace(/\bprops\./g, '');
    transformed = transformed.replace(/\bderived\./g, '');
    transformed = transformed.replace(/\bfunctions\./g, '');
    // In Vue templates, refs are automatically unwrapped, so no need to add .value
    return transformed;
}
