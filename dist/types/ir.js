"use strict";
/**
 * Durable Component Intermediate Representation (IR) v1.0
 *
 * This is the canonical JSON schema that represents a component's intent
 * in a completely framework-agnostic manner. This is the "archaeological artifact"
 * that captures component understanding decoupled from any implementation.
 *
 * Every construct in this IR has a direct, idiomatic mapping to all major frameworks.
 *
 * This component tree follows the unist (Universal Syntax Tree) specification,
 * making it compatible with the unified.js collective ecosystem.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyIR = createEmptyIR;
/**
 * Factory function to create an empty IR
 */
function createEmptyIR(name) {
    return {
        type: 'component',
        '@version': '1.0.0',
        name,
        props: [],
        state: [],
        derived: [],
        effects: [],
        refs: [],
        functions: [],
        template: {
            type: 'element',
            name: 'div',
            children: []
        },
        styles: ''
    };
}
