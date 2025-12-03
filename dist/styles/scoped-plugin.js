"use strict";
/**
 * Scoped Styles Transformer Plugin
 *
 * A unified transformer plugin that processes component styles and
 * adds scope attributes to the template tree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableScopedStyles = void 0;
const scoped_1 = require("./scoped");
/**
 * Scoped styles transformer plugin
 *
 * This plugin processes component styles and adds scope attributes
 * to the template tree for CSS scoping.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableScopedStyles } from '@durable/compiler/styles';
 * import { durableReactCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableScopedStyles)
 *   .use(durableReactCompiler);
 * ```
 */
const durableScopedStyles = function (options = {}) {
    return (tree) => {
        const mode = options.mode || 'scoped';
        if (mode === 'scoped' && tree.styles && tree.styles.trim()) {
            const { css, scopeId } = (0, scoped_1.generateScopedCSS)(tree.styles, tree.name);
            // Store scoped CSS in tree data
            if (!tree.data)
                tree.data = {};
            // @ts-ignore - extending Data with custom properties
            tree.data.scopedCSS = css;
            // Add scope attributes to template
            if (scopeId) {
                tree.template = (0, scoped_1.addScopeToTemplate)(tree.template, scopeId);
            }
        }
        else if (mode === 'inline' && tree.styles && tree.styles.trim()) {
            // Store inline styles in tree data
            if (!tree.data)
                tree.data = {};
            // @ts-ignore - extending Data with custom properties
            tree.data.inlineCSS = tree.styles;
        }
        return tree;
    };
};
exports.durableScopedStyles = durableScopedStyles;
