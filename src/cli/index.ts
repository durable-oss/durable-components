#!/usr/bin/env node

/**
 * Durable Component Compiler CLI (dcc)
 *
 * Command-line interface for compiling .dce files
 */

import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { compile } from '../index';
import type { CompilerTarget, StyleMode } from '../types/compiler';
import { startShowcaseServer } from '../showcase/server';

program
  .name('dcc')
  .description('Durable Component Compiler - compile once, run anywhere')
  .version('0.1.0');

program
  .command('compile')
  .description('Compile a .dce file to target framework')
  .argument('<input>', 'Input .dce file')
  .option('-t, --target <framework>', 'Target framework (react|vue|solid|svelte|wc)', 'react')
  .option('-s, --style <mode>', 'Style mode (scoped|inline|unocss)', 'scoped')
  .option('-o, --output <file>', 'Output file path')
  .option('--css-output <file>', 'CSS output file path')
  .action((input: string, options: any) => {
    try {
      // Read source file
      const source = fs.readFileSync(input, 'utf-8');
      const filename = path.basename(input);

      // Compile
      const result = compile(source, {
        filename,
        target: options.target as CompilerTarget,
        style: options.style as StyleMode
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
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
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

const showcaseCmd = program
  .command('showcase')
  .description('Showcase commands');

showcaseCmd
  .command('list')
  .description('List all .showcase files in the current project')
  .argument('[dir]', 'Directory to search (default: current directory)', '.')
  .action((dir: string) => {
    const rootDir = path.resolve(dir);
    const showcaseFiles = findShowcaseFiles(rootDir);

    if (showcaseFiles.length === 0) {
      console.log('No .showcase files found.');
      return;
    }

    const componentExts = new Set(['.dce', '.jsx', '.tsx', '.vue', '.svelte', '.js', '.ts']);
    const componentFiles = findComponentFiles(rootDir, componentExts);

    const linked: Array<{ showcase: string; component: string }> = [];
    const standalone: string[] = [];

    for (const showcase of showcaseFiles) {
      const baseName = path.basename(showcase, '.showcase');
      const dir2 = path.dirname(showcase);
      const match = [...componentExts].find(ext =>
        componentFiles.has(path.join(dir2, baseName + ext))
      );
      if (match) {
        linked.push({ showcase, component: path.join(dir2, baseName + match) });
      } else {
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
      if (linked.length > 0) console.log('');
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
  .action((dir: string, options: any) => {
    const rootDir = path.resolve(dir);
    const port = parseInt(options.port, 10);
    startShowcaseServer({ rootDir, port });
  });

program.parse();

function findShowcaseFiles(rootDir: string): string[] {
  const results: string[] = [];
  const ignored = new Set(['node_modules', '.git', 'dist']);

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.showcase')) {
        results.push(full);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

function findComponentFiles(rootDir: string, exts: Set<string>): Set<string> {
  const results = new Set<string>();
  const ignored = new Set(['node_modules', '.git', 'dist']);

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && exts.has(path.extname(entry.name))) {
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
function getExtension(target: string): string {
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
