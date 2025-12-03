/**
 * Tree Data Storage Plugin
 *
 * A unified transformer plugin that stores the component tree in file.data
 * so it can be accessed after compilation.
 */
import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
/**
 * Tree storage transformer plugin
 *
 * This plugin stores the component tree in file.data.tree
 * so it can be accessed after the compilation step.
 */
export declare const durableTreeStorage: Plugin<[], DurableComponentIR>;
