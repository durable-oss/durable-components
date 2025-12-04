"use strict";
/**
 * Tree Data Storage Plugin
 *
 * A unified transformer plugin that stores the component tree in file.data
 * so it can be accessed after compilation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableTreeStorage = void 0;
/**
 * Tree storage transformer plugin
 *
 * This plugin stores the component tree in file.data.tree
 * so it can be accessed after the compilation step.
 */
const durableTreeStorage = function () {
    return (tree, file) => {
        // Store tree in file data for later access
        if (!file.data) {
            file.data = {};
        }
        file.data.tree = tree;
        // Return tree unchanged
        return tree;
    };
};
exports.durableTreeStorage = durableTreeStorage;
