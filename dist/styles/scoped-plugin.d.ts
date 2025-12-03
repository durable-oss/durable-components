/**
 * Scoped Styles Transformer Plugin
 *
 * A unified transformer plugin that processes component styles and
 * adds scope attributes to the template tree.
 */
import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
/**
 * Scoped styles plugin options
 */
export interface ScopedStylesOptions {
    /** Style mode: 'scoped', 'inline', or 'none' */
    mode?: 'scoped' | 'inline' | 'none';
}
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
export declare const durableScopedStyles: Plugin<[ScopedStylesOptions?], DurableComponentIR>;
