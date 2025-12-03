#!/usr/bin/env node
"use strict";
/**
 * Durable Component Compiler CLI (dcc)
 *
 * Command-line interface for compiling .dce files
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("../index");
commander_1.program
    .name('dcc')
    .description('Durable Component Compiler - compile once, run anywhere')
    .version('0.1.0');
commander_1.program
    .command('compile')
    .description('Compile a .dce file to target framework')
    .argument('<input>', 'Input .dce file')
    .option('-t, --target <framework>', 'Target framework (react|vue|solid|svelte|wc)', 'react')
    .option('-s, --style <mode>', 'Style mode (scoped|inline|unocss)', 'scoped')
    .option('-o, --output <file>', 'Output file path')
    .option('--css-output <file>', 'CSS output file path')
    .action((input, options) => {
    try {
        // Read source file
        const source = fs.readFileSync(input, 'utf-8');
        const filename = path.basename(input);
        // Compile
        const result = (0, index_1.compile)(source, {
            filename,
            target: options.target,
            style: options.style
        });
        // Determine output paths
        let jsOutput = options.output;
        let cssOutput = options.cssOutput;
        if (!jsOutput) {
            const baseName = filename.replace(/\.dce$/, '');
            const ext = getExtension(options.target);
            jsOutput = `${baseName}.${ext}`;
        }
        if (!cssOutput && result.css) {
            const baseName = path.basename(jsOutput, path.extname(jsOutput));
            cssOutput = `${baseName}.css`;
        }
        // Write JavaScript output
        fs.writeFileSync(jsOutput, result.js.code, 'utf-8');
        console.log(`✓ Compiled to ${jsOutput}`);
        // Write CSS output if present
        if (result.css && cssOutput) {
            fs.writeFileSync(cssOutput, result.css.code, 'utf-8');
            console.log(`✓ CSS written to ${cssOutput}`);
        }
        // Show metadata
        if (result.meta) {
            console.log(`\nComponent: ${result.meta.name}`);
            if (result.meta.props.length > 0) {
                console.log(`Props: ${result.meta.props.join(', ')}`);
            }
        }
        console.log('\n✨ Compilation successful!');
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
});
commander_1.program
    .command('info')
    .description('Show compiler information')
    .action(() => {
    console.log('Durable Component Compiler v0.1.0\n');
    console.log('Supported targets:');
    console.log('  - react   (React with Hooks)');
    console.log('  - vue     (Coming soon)');
    console.log('  - solid   (Coming soon)');
    console.log('  - svelte  (Coming soon)');
    console.log('  - wc      (Web Components - Coming soon)\n');
    console.log('Style modes:');
    console.log('  - scoped  (Scoped CSS like Svelte/Vue)');
    console.log('  - inline  (Inline styles)');
    console.log('  - unocss  (UnoCSS integration - Coming soon)');
});
commander_1.program.parse();
/**
 * Get file extension for target
 */
function getExtension(target) {
    switch (target) {
        case 'react':
            return 'jsx';
        case 'vue':
            return 'vue';
        case 'solid':
            return 'jsx';
        case 'svelte':
            return 'svelte';
        case 'wc':
            return 'js';
        default:
            return 'js';
    }
}
