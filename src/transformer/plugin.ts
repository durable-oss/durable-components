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
export const durableTreeStorage: Plugin<[], DurableComponentIR> = function () {
  return (tree, file) => {
    // Store tree in file data for later access
    if (!file.data) {
      (file as any).data = {};
    }
    file.data.tree = tree;

    // Return tree unchanged
    return tree;
  };
};
