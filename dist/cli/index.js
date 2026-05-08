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
const server_1 = require("../showcase/server");
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
const showcaseCmd = commander_1.program
    .command('showcase')
    .description('Showcase commands');
showcaseCmd
    .command('list')
    .description('List all .showcase files in the current project')
    .argument('[dir]', 'Directory to search (default: current directory)', '.')
    .action((dir) => {
    const rootDir = path.resolve(dir);
    const showcaseFiles = findShowcaseFiles(rootDir);
    if (showcaseFiles.length === 0) {
        console.log('No .showcase files found.');
        return;
    }
    const componentExts = new Set(['.dce', '.jsx', '.tsx', '.vue', '.svelte', '.js', '.ts']);
    const componentFiles = findComponentFiles(rootDir, componentExts);
    const linked = [];
    const standalone = [];
    for (const showcase of showcaseFiles) {
        const baseName = path.basename(showcase, '.showcase');
        const dir2 = path.dirname(showcase);
        const match = [...componentExts].find(ext => componentFiles.has(path.join(dir2, baseName + ext)));
        if (match) {
            linked.push({ showcase, component: path.join(dir2, baseName + match) });
        }
        else {
            standalone.push(showcase);
        }
    }
    if (linked.length > 0) {
        console.log('Component Showcases:');
        for (const { showcase, component } of linked) {
            const rel = path.relative(rootDir, showcase);
            const compRel = path.relative(rootDir, component);
            console.log(`  ${rel}  →  ${compRel}`);
        }
    }
    if (standalone.length > 0) {
        if (linked.length > 0)
            console.log('');
        console.log('Demo Files:');
        for (const f of standalone) {
            console.log(`  ${path.relative(rootDir, f)}`);
        }
    }
});
showcaseCmd
    .command('serve')
    .description('Start the showcase browser UI with hot reload')
    .argument('[dir]', 'Root directory to search for .showcase files', '.')
    .option('-p, --port <number>', 'Port to listen on', '4242')
    .action((dir, options) => {
    const rootDir = path.resolve(dir);
    const port = parseInt(options.port, 10);
    (0, server_1.startShowcaseServer)({ rootDir, port });
});
commander_1.program.parse();
function findShowcaseFiles(rootDir) {
    const results = [];
    const ignored = new Set(['node_modules', '.git', 'dist']);
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignored.has(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile() && entry.name.endsWith('.showcase')) {
                results.push(full);
            }
        }
    }
    walk(rootDir);
    return results.sort();
}
function findComponentFiles(rootDir, exts) {
    const results = new Set();
    const ignored = new Set(['node_modules', '.git', 'dist']);
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignored.has(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile() && exts.has(path.extname(entry.name))) {
                results.add(full);
            }
        }
    }
    walk(rootDir);
    return results;
}
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
